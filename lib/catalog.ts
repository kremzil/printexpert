import "server-only";

import { cacheLife, cacheTag } from "next/cache";

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
  "use cache";
  cacheTag("categories");
  cacheLife("hours");
  const prisma = getPrisma();
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryBySlug(slug: string) {
  "use cache";
  cacheTag("categories", `category:${slug}`);
  cacheLife("hours");
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
  "use cache";
  const tags = new Set<string>(["products"]);
  if (categorySlug) {
    tags.add(`category:${categorySlug}`);
  }
  if (categorySlugs) {
    categorySlugs.forEach((slug) => tags.add(`category:${slug}`));
  }
  // include audience in cache tags so personalised views are cached separately
  if (audience) tags.add(`audience:${audience}`)
  else tags.add(`audience:all`)
  cacheTag(...Array.from(tags));
  cacheLife("hours");
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
  "use cache";
  // audience must be passed from caller (do not access cookies inside use cache)
  // caller should call getProductBySlug(slug, audience)
  cacheTag("products", `product:${slug}`);
  cacheLife("hours");
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
  "use cache";
  cacheTag("categories");
  cacheLife("hours");
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
  "use cache";
  cacheTag("products");
  cacheLife("hours");
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
  "use cache";
  cacheTag("products", `product-id:${id}`);
  cacheLife("hours");
  const prisma = getPrisma();
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });

  return product ? serializeProduct(product) : null;
}
