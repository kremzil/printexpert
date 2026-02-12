import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache-tags";

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const parseSortOrder = (value: unknown, fallback: number) => {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;
  const existing = await prisma.productCollection.findUnique({
    where: { id: collectionId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Kolekcia neexistuje." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatné dáta." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const hasName = Object.prototype.hasOwnProperty.call(payload, "name");
  const hasSlug = Object.prototype.hasOwnProperty.call(payload, "slug");
  const hasImage = Object.prototype.hasOwnProperty.call(payload, "image");
  const hasDescription = Object.prototype.hasOwnProperty.call(
    payload,
    "description"
  );
  const hasProductIds = Object.prototype.hasOwnProperty.call(payload, "productIds");
  const hasIsActive = Object.prototype.hasOwnProperty.call(payload, "isActive");
  const hasShowInB2b = Object.prototype.hasOwnProperty.call(payload, "showInB2b");
  const hasShowInB2c = Object.prototype.hasOwnProperty.call(payload, "showInB2c");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(payload, "sortOrder");

  const nextName = hasName ? String(payload.name ?? "").trim() : existing.name;
  if (!nextName) {
    return NextResponse.json({ error: "Názov je povinný." }, { status: 400 });
  }

  const nextImage = hasImage
    ? String(payload.image ?? "").trim()
    : existing.image;
  if (!nextImage) {
    return NextResponse.json({ error: "Obrázok je povinný." }, { status: 400 });
  }

  let nextSlug = existing.slug;
  if (hasSlug) {
    const slugInput = String(payload.slug ?? "").trim();
    nextSlug = normalizeSlug(slugInput || nextName);
    if (!nextSlug) {
      return NextResponse.json({ error: "Neplatný slug." }, { status: 400 });
    }
  }

  if (nextSlug !== existing.slug) {
    const slugConflict = await prisma.productCollection.findUnique({
      where: { slug: nextSlug },
      select: { id: true },
    });
    if (slugConflict && slugConflict.id !== existing.id) {
      return NextResponse.json(
        { error: "Kolekcia s týmto slug už existuje." },
        { status: 409 }
      );
    }
  }

  const nextDescription = hasDescription
    ? String(payload.description ?? "").trim() || null
    : existing.description;
  const nextProductIds = hasProductIds
    ? await filterExistingProductIds(normalizeProductIds(payload.productIds))
    : existing.productIds;
  const nextIsActive =
    hasIsActive && typeof payload.isActive === "boolean"
      ? payload.isActive
      : existing.isActive;
  const nextShowInB2b =
    hasShowInB2b && typeof payload.showInB2b === "boolean"
      ? payload.showInB2b
      : existing.showInB2b;
  const nextShowInB2c =
    hasShowInB2c && typeof payload.showInB2c === "boolean"
      ? payload.showInB2c
      : existing.showInB2c;
  const nextSortOrder = hasSortOrder
    ? parseSortOrder(payload.sortOrder, existing.sortOrder)
    : existing.sortOrder;

  const updated = await prisma.productCollection.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      slug: nextSlug,
      image: nextImage,
      description: nextDescription,
      productIds: nextProductIds,
      isActive: nextIsActive,
      showInB2b: nextShowInB2b,
      showInB2c: nextShowInB2c,
      sortOrder: nextSortOrder,
    },
  });

  revalidateTag(TAGS.COLLECTIONS, "max");
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;
  const existing = await prisma.productCollection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Kolekcia neexistuje." }, { status: 404 });
  }

  await prisma.productCollection.delete({
    where: { id: collectionId },
  });

  revalidateTag(TAGS.COLLECTIONS, "max");
  return NextResponse.json({ success: true });
}
