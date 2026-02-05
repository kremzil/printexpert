import "server-only";

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
}) {
  const prisma = getPrisma();
  const {
    audience,
    categoryIds,
    query,
    sort = "relevance",
    page = 1,
    pageSize = 24,
  } = options;

  const audienceFilter = audience
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
