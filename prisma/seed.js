const fs = require("fs");
const path = require("path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function loadExportedArray(filePath, exportName) {
  const source = fs.readFileSync(filePath, "utf8");
  const withoutImports = source.replace(/^\s*import\s+type\s+.*$/gm, "");
  const withoutExport = withoutImports
    .replace(
      new RegExp(`export\\s+const\\s+${exportName}\\s*:\\s*[^=]+=`),
      `const ${exportName} =`
    )
    .replace(
      new RegExp(`export\\s+const\\s+${exportName}\\s*=`),
      `const ${exportName} =`
    );
  const wrapped = `${withoutExport}\nreturn ${exportName};`;

  return new Function(wrapped)();
}

function loadWpTable(fileName, tableName) {
  const filePath = path.join(__dirname, "..", "data", "wp", fileName);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const table = json.find(
    (item) => item.type === "table" && item.name === tableName
  );

  if (!table?.data) {
    throw new Error(`Missing table "${tableName}" in ${fileName}`);
  }

  return table.data;
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumbersList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizePrice(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (/^\d+\.\d{3}$/.test(text)) {
    return text.replace(".", "");
  }

  if (/^\d+,\d+$/.test(text)) {
    return text.replace(",", ".");
  }

  return text;
}

async function importWpPricing({ productSlug, wpProductId } = {}) {
  const matrixTypes = loadWpTable(
    "wp_print_products_matrix_types.json",
    "mxtcds_wp_print_products_matrix_types"
  );
  const matrixPrices = loadWpTable(
    "wp_print_products_matrix_prices.json",
    "mxtcds_wp_print_products_matrix_prices"
  );
  const posts = loadWpTable("wp_print_posts.json", "mxtcds_wp_posts");

  const wpProductsById = new Map(
    posts
      .filter((post) => post.post_type === "product")
      .map((post) => [String(post.ID), post])
  );

  const localProducts = await prisma.product.findMany({
    select: { id: true, slug: true },
  });
  const localBySlug = new Map(
    localProducts.map((product) => [product.slug, product])
  );

  const wpToLocal = new Map();
  for (const [id, post] of wpProductsById.entries()) {
    const local = localBySlug.get(post.post_name);
    if (local) {
      wpToLocal.set(id, local);
    }
  }

  const filterSlug = productSlug ? String(productSlug) : null;
  const filterWpId = wpProductId ? String(wpProductId) : null;
  const hasFilter = Boolean(filterSlug || filterWpId);

  const pricingModelByMtypeId = new Map();
  let modelsImported = 0;

  for (const row of matrixTypes) {
    const sourceProductId = String(row.product_id);
    if (filterWpId && sourceProductId !== filterWpId) {
      continue;
    }

    const localProduct = wpToLocal.get(sourceProductId);
    if (!localProduct) {
      continue;
    }

    if (filterSlug && localProduct.slug !== filterSlug) {
      continue;
    }

    const sourceMtypeId = parseIntOrNull(row.mtype_id);
    if (!sourceMtypeId) {
      continue;
    }

    const kind = String(row.mtype) === "1" ? "FINISHING" : "BASE";
    const breakpoints = parseNumbersList(row.numbers);
    const numStyle = parseIntOrNull(row.num_style);
    const numType = parseIntOrNull(row.num_type);

    const meta = {
      wpProductId: row.product_id,
      mtype: row.mtype,
      title: row.title,
      def_quantity: row.def_quantity,
      attributes: row.attributes,
      aterms: row.aterms,
      numbers: row.numbers,
      num_style: row.num_style,
      num_type: row.num_type,
      bq_numbers: row.bq_numbers,
      ltext_attr: row.ltext_attr,
      book_min_quantity: row.book_min_quantity,
      pq_style: row.pq_style,
      pq_numbers: row.pq_numbers,
      sorder: row.sorder,
      min_qmailed: row.min_qmailed,
    };

    const pricingModel = await prisma.pricingModel.upsert({
      where: {
        productId_sourceMtypeId: {
          productId: localProduct.id,
          sourceMtypeId,
        },
      },
      update: {
        kind,
        breakpoints,
        numStyle,
        numType,
        meta,
        isActive: true,
      },
      create: {
        productId: localProduct.id,
        kind,
        sourceMtypeId,
        breakpoints,
        numStyle,
        numType,
        meta,
        isActive: true,
      },
    });

    pricingModelByMtypeId.set(String(sourceMtypeId), pricingModel);
    modelsImported += 1;
  }

  let entriesImported = 0;
  const entriesByModelId = new Map();

  for (const row of matrixPrices) {
    const mtypeId = String(row.mtype_id);
    const pricingModel = pricingModelByMtypeId.get(mtypeId);
    if (!pricingModel) {
      continue;
    }

    const attrsKey = String(row.aterms || "");
    const breakpoint = parseIntOrNull(row.number);
    const price = normalizePrice(row.price);

    if (!attrsKey || !breakpoint || price === null) {
      continue;
    }

    const key = pricingModel.id;
    if (!entriesByModelId.has(key)) {
      entriesByModelId.set(key, []);
    }

    entriesByModelId.get(key).push({
      pricingModelId: pricingModel.id,
      attrsKey,
      breakpoint,
      price,
    });
  }

  for (const [pricingModelId, entries] of entriesByModelId.entries()) {
    await prisma.pricingEntry.deleteMany({
      where: { pricingModelId },
    });

    const chunkSize = 1000;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      await prisma.pricingEntry.createMany({ data: chunk });
      entriesImported += chunk.length;
    }
  }

  if (!hasFilter) {
    const mappedWpIds = new Set(wpToLocal.keys());
    const unmappedCount = matrixTypes.filter(
      (row) => !mappedWpIds.has(String(row.product_id))
    ).length;
    console.log(
      `WP pricing import: models=${modelsImported}, entries=${entriesImported}, unmappedTypes=${unmappedCount}`
    );
  } else {
    console.log(
      `WP pricing import: models=${modelsImported}, entries=${entriesImported}`
    );
  }
}

async function main() {
  const categories = loadExportedArray(
    path.join(__dirname, "..", "data", "categories.ts"),
    "categories"
  );
  const products = loadExportedArray(
    path.join(__dirname, "..", "data", "products.ts"),
    "products"
  );

  await prisma.category.deleteMany({
    where: {
      slug: {
        in: [
          "peciatky-peciatky-standardne",
          "peciatky-peciatky-podlhovaste",
          "peciatky-peciatky-stvorcove",
          "peciatky-peciatky-okruhle",
          "peciatky-peciatky-ovalne",
        ],
      },
    },
  });

  const categoryBySlug = new Map();

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        image: category.image,
        description: category.description ?? null,
        sortOrder: category.sortOrder ?? 0,
        isActive: category.isActive ?? true,
        parentId: null,
      },
      create: {
        slug: category.slug,
        name: category.name,
        image: category.image,
        description: category.description ?? null,
        sortOrder: category.sortOrder ?? 0,
        isActive: category.isActive ?? true,
        parentId: null,
      },
    });

    categoryBySlug.set(saved.slug, saved);
  }

  for (const category of categories) {
    if (!category.parentSlug) {
      continue;
    }

    const parent = categoryBySlug.get(category.parentSlug);
    const child = categoryBySlug.get(category.slug);

    if (!parent || !child) {
      continue;
    }

    await prisma.category.update({
      where: { id: child.id },
      data: { parentId: parent.id },
    });
  }

  for (const product of products) {
    const category = categoryBySlug.get(product.categorySlug);

    if (!category) {
      throw new Error(
        `Missing category for product "${product.slug}": ${product.categorySlug}`
      );
    }

    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.title,
        categoryId: category.id,
        wpProductId: product.wpProductId ?? null,
        excerpt: product.excerpt ?? null,
        description: product.description ?? null,
        priceType: product.priceType ?? "ON_REQUEST",
        priceFrom: product.priceFrom ?? null,
        vatRate: product.vatRate ?? "0.20",
        isActive: product.isActive ?? true,
      },
      create: {
        slug: product.slug,
        name: product.title,
        categoryId: category.id,
        wpProductId: product.wpProductId ?? null,
        excerpt: product.excerpt ?? null,
        description: product.description ?? null,
        priceType: product.priceType ?? "ON_REQUEST",
        priceFrom: product.priceFrom ?? null,
        vatRate: product.vatRate ?? "0.20",
        isActive: product.isActive ?? true,
      },
    });

    const imageList = Array.isArray(product.image)
      ? product.image
      : product.image
      ? [product.image]
      : [];

    if (imageList.length === 0) {
      await prisma.productImage.deleteMany({
        where: { productId: saved.id },
      });
    } else {
      for (const [index, url] of imageList.entries()) {
        await prisma.productImage.upsert({
          where: {
            productId_url: {
              productId: saved.id,
              url,
            },
          },
          update: {
            alt: product.title ?? null,
            sortOrder: index,
            isPrimary: index === 0,
          },
          create: {
            productId: saved.id,
            url,
            alt: product.title ?? null,
            sortOrder: index,
            isPrimary: index === 0,
          },
        });
      }

      await prisma.productImage.deleteMany({
        where: {
          productId: saved.id,
          url: { notIn: imageList },
        },
      });
    }
  }

  if (process.env.IMPORT_WP_PRICING === "1") {
    await importWpPricing({
      productSlug: process.env.IMPORT_WP_PRODUCT_SLUG,
      wpProductId: process.env.IMPORT_WP_WP_PRODUCT_ID,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
