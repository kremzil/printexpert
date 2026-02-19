import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache-tags";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const parseSortOrder = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProductIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

const filterExistingProductIds = async (productIds: string[]) => {
  if (productIds.length === 0) {
    return [];
  }

  const existingProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingProducts.map((product) => product.id));
  return productIds.filter((productId) => existingIds.has(productId));
};

const ensureAdmin = async () => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
};

const GETHandler = async () => {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collections = await prisma.productCollection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(collections);
}

const POSTHandler = async (request: NextRequest) => {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatné dáta." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const name = String(payload.name ?? "").trim();
  const image = String(payload.image ?? "").trim();
  const rawSlug = String(payload.slug ?? "").trim();
  const descriptionRaw = String(payload.description ?? "").trim();
  const isActive =
    typeof payload.isActive === "boolean" ? payload.isActive : true;
  const showInB2b =
    typeof payload.showInB2b === "boolean" ? payload.showInB2b : true;
  const showInB2c =
    typeof payload.showInB2c === "boolean" ? payload.showInB2c : true;
  const sortOrder = parseSortOrder(payload.sortOrder, 0);

  if (!name || !image) {
    return NextResponse.json(
      { error: "Názov a obrázok sú povinné." },
      { status: 400 }
    );
  }

  const slug = normalizeSlug(rawSlug || name);
  if (!slug) {
    return NextResponse.json({ error: "Neplatný slug." }, { status: 400 });
  }

  const existingSlug = await prisma.productCollection.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existingSlug) {
    return NextResponse.json(
      { error: "Kolekcia s týmto slug už existuje." },
      { status: 409 }
    );
  }

  const normalizedProductIds = normalizeProductIds(payload.productIds);
  const productIds = await filterExistingProductIds(normalizedProductIds);

  const created = await prisma.productCollection.create({
    data: {
      name,
      slug,
      image,
      description: descriptionRaw || null,
      productIds,
      isActive,
      showInB2b,
      showInB2c,
      sortOrder,
    },
  });

  revalidateTag(TAGS.COLLECTIONS, "max");
  return NextResponse.json(created, { status: 201 });
}

export const GET = withObservedRoute("GET /api/admin/collections", GETHandler);
export const POST = withObservedRoute("POST /api/admin/collections", POSTHandler);



