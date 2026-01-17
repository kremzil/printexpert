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

export async function getProducts({ categorySlug }: { categorySlug?: string }) {
  const prisma = getPrisma();
  return prisma.product.findMany({
    where: {
      isActive: true,
      category: {
        isActive: true,
        ...(categorySlug ? { slug: categorySlug } : {}),
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
