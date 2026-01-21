import "server-only";

import { getPrisma } from "@/lib/prisma";

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
}: {
  categorySlug?: string;
  categorySlugs?: string[];
}) {
  const prisma = getPrisma();
  const slugFilter =
    categorySlugs && categorySlugs.length > 0
      ? { in: categorySlugs }
      : categorySlug
        ? categorySlug
        : undefined;
  return prisma.product.findMany({
    where: {
      isActive: true,
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
}

export async function getProductBySlug(slug: string) {
  const prisma = getPrisma();
  return prisma.product.findFirst({
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
}

export async function getAdminProducts() {
  const prisma = getPrisma();
  return prisma.product.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      category: true,
    },
  });
}

export async function getAdminProductById(id: string) {
  const prisma = getPrisma();
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });
}
