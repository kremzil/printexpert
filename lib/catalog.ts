import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@/lib/generated/prisma";
import { getPrisma } from "@/lib/prisma";

const serializeProduct = <
  T extends {
    priceFrom: { toString(): string } | null;
    vatRate: { toString(): string };
  },
>(
  product: T
) => ({
  ...product,
  priceFrom: product.priceFrom ? product.priceFrom.toString() : null,
  vatRate: product.vatRate.toString(),
});

export async function getCategories() {
  const prisma = getPrisma();
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryBySlug(slug: string) {
  const prisma = getPrisma();
  return prisma.category.findFirst({
    where: { slug, isActive: true },
  });
}

export async function getProducts({
  categorySlug,
  categorySlugs,
  audience,
}: {
  categorySlug?: string;
  categorySlugs?: string[];
  audience?: string | null;
}) {
  const prisma = getPrisma();
  const slugFilter =
    categorySlugs && categorySlugs.length > 0
      ? { in: categorySlugs }
      : categorySlug
        ? categorySlug
        : undefined;
  const audienceFilter = audience
    ? audience === "b2b"
      ? { showInB2b: true }
      : audience === "b2c"
        ? { showInB2c: true }
        : {}
    : {}
  const categoryAudienceFilter = audienceFilter
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...audienceFilter,
      category: {
        isActive: true,
        ...categoryAudienceFilter,
        ...(slugFilter ? { slug: slugFilter } : {}),
      },
    },
    orderBy: [{ name: "asc" }],
    include: {
      images: {
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  return products.map(serializeProduct);
}

export type CatalogSort = "relevance" | "popular" | "price-asc" | "price-desc" | "name";

export async function getCatalogProducts(options: {
  audience?: string | null;
  categoryIds?: string[] | null;
  query?: string | null;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
}) {
  const prisma = getPrisma();
  const {
    audience,
    categoryIds,
    query,
    sort = "relevance",
    page = 1,
    pageSize = 24,
    includeHidden = false,
  } = options;

  const shouldApplyAudience = !includeHidden && Boolean(audience);
  const audienceFilter = shouldApplyAudience
    ? audience === "b2b"
      ? { showInB2b: true }
      : audience === "b2c"
        ? { showInB2c: true }
        : {}
    : {};
  const categoryAudienceFilter = audienceFilter

  const where = {
    isActive: true,
    ...audienceFilter,
    category: {
      isActive: true,
      ...categoryAudienceFilter,
    },
    ...(categoryIds && categoryIds.length > 0
      ? { categoryId: { in: categoryIds } }
      : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { excerpt: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "price-asc"
      ? [{ priceFrom: "asc" as const }]
      : sort === "price-desc"
        ? [{ priceFrom: "desc" as const }]
        : [{ name: "asc" as const }];

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        excerpt: true,
        description: true,
        priceFrom: true,
        vatRate: true,
        categoryId: true,
        images: {
          take: 1,
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { id: "asc" },
          ],
          select: {
            url: true,
            alt: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(serializeProduct),
    total,
    page,
    pageSize,
  };
}

export async function getCategoryProductCounts(options: {
  audience?: string | null;
}) {
  const prisma = getPrisma();
  const { audience } = options;
  const audienceFilter = audience
    ? audience === "b2b"
      ? { showInB2b: true }
      : audience === "b2c"
        ? { showInB2c: true }
      : {}
    : {};
  const categoryAudienceFilter = audienceFilter

  const rows = await prisma.product.groupBy({
    by: ["categoryId"],
    where: {
      isActive: true,
      ...audienceFilter,
      category: {
        isActive: true,
        ...categoryAudienceFilter,
      },
    },
    _count: {
      _all: true,
    },
  });

  return new Map(rows.map((row) => [row.categoryId, row._count._all]));
}

export async function getProductBySlug(slug: string) {
  const prisma = getPrisma();
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      images: {
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  return product ? serializeProduct(product) : null;
}

export async function getAdminCategories() {
  const prisma = getPrisma();
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: true,
          children: true,
        },
      },
    },
  });
}

export async function getAdminProducts() {
  const prisma = getPrisma();
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      category: true,
      images: {
        where: { isPrimary: true },
        take: 1,
      },
      _count: {
        select: {
          orderItems: true
        }
      }
    },
  });

  return products.map(serializeProduct);
}

export async function getAdminProductById(id: string) {
  const prisma = getPrisma();
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: {
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
        ],
      },
    },
  });

  return product ? serializeProduct(product) : null;
}

// ===== Top Products (server-side, cached) =====

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function fetchTopProducts(audience: string, count: number) {
  const prisma = getPrisma();
  const productAudienceFilter =
    audience === "b2b" ? { showInB2b: true as const } : { showInB2c: true as const };
  const categoryAudienceFilter = productAudienceFilter;

  const imagesInclude = {
    images: {
      orderBy: [
        { isPrimary: "desc" as const },
        { sortOrder: "asc" as const },
        { id: "asc" as const },
      ],
    },
  };

  let config;
  try {
    config = await prisma.topProducts.findUnique({ where: { audience } });
  } catch {
    config = null;
  }

  let products;
  const isManualMode = config?.mode === "MANUAL";

  if (!config || config.mode === "RANDOM_ALL") {
    products = await getRandomProducts({
      prisma,
      audience,
      count,
      imagesInclude,
    });
  } else if (config.mode === "RANDOM_CATEGORIES") {
    products =
      config.categoryIds && config.categoryIds.length > 0
        ? await getRandomProducts({
            prisma,
            audience,
            count,
            categoryIds: config.categoryIds,
            imagesInclude,
          })
        : [];
  } else if (config.mode === "MANUAL") {
    products = await prisma.product.findMany({
      where: {
        id: { in: config.productIds },
        isActive: true,
        ...productAudienceFilter,
        category: { isActive: true, ...categoryAudienceFilter },
      },
      include: imagesInclude,
    });
  }

  // Fill up if still not enough
  if (!isManualMode && (!products || products.length < count)) {
    const existing = products || [];
    const existingIds = existing.map((p) => p.id);
    const additional = await prisma.product.findMany({
      where: {
        isActive: true,
        ...productAudienceFilter,
        id: { notIn: existingIds },
        category: { isActive: true, ...categoryAudienceFilter },
      },
      take: count - existing.length,
      include: imagesInclude,
    });
    products = [...existing, ...shuffleArray(additional)];
  }

  return (products || []).map(serializeProduct);
}

async function getRandomProducts(options: {
  prisma: ReturnType<typeof getPrisma>;
  audience: string;
  count: number;
  categoryIds?: string[];
  imagesInclude: Prisma.ProductFindManyArgs["include"];
}) {
  const { prisma, audience, count, categoryIds, imagesInclude } = options;

  if (categoryIds && categoryIds.length === 0) {
    return [];
  }

  const productAudienceSql =
    audience === "b2b"
      ? Prisma.sql`p."showInB2b" = true`
      : Prisma.sql`p."showInB2c" = true`;
  const categoryAudienceSql =
    audience === "b2b"
      ? Prisma.sql`c."showInB2b" = true`
      : Prisma.sql`c."showInB2c" = true`;
  const categoryFilterSql =
    categoryIds && categoryIds.length > 0
      ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(categoryIds)})`
      : Prisma.empty;

  const query = Prisma.sql`
    SELECT p.id
    FROM "Product" p
    INNER JOIN "Category" c ON c.id = p."categoryId"
    WHERE p."isActive" = true
      AND c."isActive" = true
      AND ${productAudienceSql}
      AND ${categoryAudienceSql}
      ${categoryFilterSql}
    ORDER BY RANDOM()
    LIMIT ${count};
  `;
  const rows = await prisma.$queryRaw<{ id: string }[]>(query);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: imagesInclude,
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  return products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export const getTopProducts = unstable_cache(
  fetchTopProducts,
  ["top-products"],
  { revalidate: 60, tags: ["top-products"] }
);
