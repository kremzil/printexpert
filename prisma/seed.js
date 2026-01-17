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

async function main() {
  const categories = loadExportedArray(
    path.join(__dirname, "..", "data", "categories.ts"),
    "categories"
  );
  const products = loadExportedArray(
    path.join(__dirname, "..", "data", "products.ts"),
    "products"
  );

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
      },
      create: {
        slug: category.slug,
        name: category.name,
        image: category.image,
        description: category.description ?? null,
        sortOrder: category.sortOrder ?? 0,
        isActive: category.isActive ?? true,
      },
    });

    categoryBySlug.set(saved.slug, saved);
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
        excerpt: product.excerpt ?? null,
        description: product.description ?? null,
        priceType: product.priceType ?? "ON_REQUEST",
        priceFrom: product.priceFrom ?? null,
        vatRate: product.vatRate ?? "0.20",
        isActive: product.isActive ?? true,
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: saved.id },
    });

    const imageList = Array.isArray(product.image)
      ? product.image
      : product.image
      ? [product.image]
      : [];

    if (imageList.length > 0) {
      await prisma.productImage.createMany({
        data: imageList.map((url, index) => ({
          productId: saved.id,
          url,
          alt: product.title ?? null,
          sortOrder: index,
          isPrimary: index === 0,
        })),
      });
    }
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
