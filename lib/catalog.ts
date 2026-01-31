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
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...audienceFilter,
      category: {
        isActive: true,
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
