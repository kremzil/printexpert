import "server-only";

import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { getAudienceFilter } from "@/lib/audience-filter";
import { TAGS, productTag } from "@/lib/cache-tags";

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

const getCachedCategories = unstable_cache(
  async () => {
    const prisma = getPrisma();
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },
  ["catalog-categories"],
  { tags: [TAGS.CATEGORIES] }
);

export async function getCategories() {
  return getCachedCategories();
}

export async function getCategoryBySlug(slug: string) {
  const prisma = getPrisma();
  return prisma.category.findFirst({
    where: { slug, isActive: true },
  });
}

const getCachedProducts = unstable_cache(
  async ({
    categorySlug,
    categorySlugs,
    audience,
  }: {
    categorySlug?: string;
    categorySlugs?: string[];
    audience?: string | null;
  }) => {
    const prisma = getPrisma();
    const slugFilter =
      categorySlugs && categorySlugs.length > 0
        ? { in: categorySlugs }
        : categorySlug
          ? categorySlug
          : undefined;
    const audienceFilter = getAudienceFilter(audience);
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
  },
  ["catalog-products"],
  { tags: [TAGS.PRODUCTS] }
);

export async function getProducts({
  categorySlug,
  categorySlugs,
  audience,
}: {
  categorySlug?: string;
  categorySlugs?: string[];
  audience?: string | null;
}) {
  return getCachedProducts({ categorySlug, categorySlugs, audience });
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
  const audienceFilter = getAudienceFilter(shouldApplyAudience ? audience : null);
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

const getCachedCategoryProductCounts = unstable_cache(
  async (audience?: string | null) => {
    const prisma = getPrisma();
    const audienceFilter = getAudienceFilter(audience);
    const categoryAudienceFilter = audienceFilter;

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

    return rows.map((row) => [row.categoryId, row._count._all] as const);
  },
  ["category-product-counts"],
  { tags: [TAGS.PRODUCT_COUNTS] }
);

export async function getCategoryProductCounts(options: {
  audience?: string | null;
}) {
  const { audience } = options;
  const rows = await getCachedCategoryProductCounts(audience ?? null);
  return new Map(rows);
}

export async function getProductBySlug(slug: string) {
  return unstable_cache(
    async () => {
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
    },
    ["product-by-slug", slug],
    { tags: [productTag(slug), TAGS.PRODUCTS] }
  )();
}

const getCachedRelatedProducts = unstable_cache(
  async (categorySlug: string, audience: string | null, excludeId: string) => {
    const prisma = getPrisma();
    const audienceFilter = getAudienceFilter(audience);
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: excludeId },
        ...audienceFilter,
        category: {
          isActive: true,
          ...audienceFilter,
          slug: categorySlug,
        },
      },
      orderBy: [{ name: "asc" }],
      take: 4,
      select: {
        id: true,
        slug: true,
        name: true,
        excerpt: true,
        priceFrom: true,
        vatRate: true,
        images: {
          take: 1,
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { id: "asc" },
          ],
          select: { url: true, alt: true },
        },
      },
    });

    return products.map(serializeProduct);
  },
  ["related-products"],
  { tags: [TAGS.RELATED], revalidate: 3600 }
);

export async function getRelatedProducts(
  categorySlug: string,
  audience: string | null,
  excludeId: string
) {
  return getCachedRelatedProducts(categorySlug, audience, excludeId);
}

const normalizeProductIds = (productIds: string[]) =>
  Array.from(new Set(productIds.map((id) => id.trim()).filter(Boolean)));

const getCachedHomepageCollections = unstable_cache(
  async (audience?: string | null) => {
    const prisma = getPrisma();
    const audienceFilter = getAudienceFilter(audience);

    return prisma.productCollection.findMany({
      where: {
        isActive: true,
        ...audienceFilter,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },
  ["homepage-collections"],
  { tags: [TAGS.COLLECTIONS] }
);

export async function getHomepageCollections(audience?: string | null) {
  return getCachedHomepageCollections(audience ?? null);
}

export async function getCollectionBySlug(
  slug: string,
  audience?: string | null
) {
  return unstable_cache(
    async () => {
      const prisma = getPrisma();
      const audienceFilter = getAudienceFilter(audience);
      return prisma.productCollection.findFirst({
        where: {
          slug,
          isActive: true,
          ...audienceFilter,
        },
      });
    },
    ["collection-by-slug", slug, audience ?? "all"],
    { tags: [TAGS.COLLECTIONS] }
  )();
}

const getCachedCollectionProducts = unstable_cache(
  async ({
    productIds,
    audience,
  }: {
    productIds: string[];
    audience?: string | null;
  }) => {
    const orderedIds = normalizeProductIds(productIds);
    if (orderedIds.length === 0) {
      return [];
    }

    const prisma = getPrisma();
    const audienceFilter = getAudienceFilter(audience);
    const categoryAudienceFilter = audienceFilter;
    const products = await prisma.product.findMany({
      where: {
        id: { in: orderedIds },
        isActive: true,
        ...audienceFilter,
        category: {
          isActive: true,
          ...categoryAudienceFilter,
        },
      },
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

    const order = new Map(orderedIds.map((id, index) => [id, index]));
    return products
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(serializeProduct);
  },
  ["collection-products"],
  { tags: [TAGS.COLLECTIONS, TAGS.PRODUCTS] }
);

export async function getCollectionProducts(
  productIds: string[],
  audience?: string | null
) {
  const orderedIds = normalizeProductIds(productIds);
  if (orderedIds.length === 0) {
    return [];
  }
  return getCachedCollectionProducts({
    productIds: orderedIds,
    audience: audience ?? null,
  });
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
      designTemplates: {
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
      },
    },
  });

  return product ? serializeProduct(product) : null;
}

// ===== Top Products (server-side, cached) =====

async function fetchTopProducts(audience: string, count: number) {
  const prisma = getPrisma();
  const productAudienceFilter = getAudienceFilter(audience);
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

  const productIds = config?.productIds ?? [];
  if (productIds.length === 0) {
    return [];
  }

  const orderedIds = productIds.slice(0, count);
  const products = await prisma.product.findMany({
    where: {
      id: { in: orderedIds },
      isActive: true,
      ...productAudienceFilter,
      category: { isActive: true, ...categoryAudienceFilter },
    },
    include: imagesInclude,
  });

  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return products
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(serializeProduct);
}

export const getTopProducts = unstable_cache(
  fetchTopProducts,
  ["top-products"],
  { tags: [TAGS.TOP_PRODUCTS] }
);
