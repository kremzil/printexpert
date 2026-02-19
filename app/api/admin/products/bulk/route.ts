import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TAGS, invalidateCategories } from "@/lib/cache-tags";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

type BulkAction = "setCategory" | "setVisibility" | "delete";

type BulkBody = {
  action?: BulkAction;
  productIds?: string[];
  categoryId?: string | null;
  visibility?: {
    isActive?: boolean;
    showInB2b?: boolean;
    showInB2c?: boolean;
  };
};

const POSTHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as BulkBody | null;
  const action = body?.action;
  const productIds = Array.isArray(body?.productIds)
    ? body.productIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (!action || !["setCategory", "setVisibility", "delete"].includes(action)) {
    return NextResponse.json({ error: "Neplatná bulk akcia." }, { status: 400 });
  }

  if (productIds.length === 0) {
    return NextResponse.json({ error: "Nie sú vybrané žiadne produkty." }, { status: 400 });
  }

  if (action === "setCategory") {
    if (!body?.categoryId) {
      return NextResponse.json({ error: "Chýba cieľová kategória." }, { status: 400 });
    }

    const categoryExists = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!categoryExists) {
      return NextResponse.json({ error: "Kategória neexistuje." }, { status: 404 });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { categoryId: body.categoryId },
    });

    revalidateTag(TAGS.PRODUCTS, "max");
    invalidateCategories();

    return NextResponse.json({
      ok: true,
      action,
      updated: result.count,
    });
  }

  if (action === "setVisibility") {
    const visibility = body?.visibility ?? {};
    const data: {
      isActive?: boolean;
      showInB2b?: boolean;
      showInB2c?: boolean;
    } = {};

    if (typeof visibility.isActive === "boolean") data.isActive = visibility.isActive;
    if (typeof visibility.showInB2b === "boolean") data.showInB2b = visibility.showInB2b;
    if (typeof visibility.showInB2c === "boolean") data.showInB2c = visibility.showInB2c;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nezadané hodnoty viditeľnosti." }, { status: 400 });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data,
    });

    revalidateTag(TAGS.PRODUCTS, "max");
    invalidateCategories();

    return NextResponse.json({
      ok: true,
      action,
      updated: result.count,
    });
  }

  // delete
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      _count: {
        select: {
          orderItems: true,
          cartItems: true,
          savedCartItems: true,
        },
      },
    },
  });

  const deleted: string[] = [];
  const deactivated: string[] = [];

  for (const product of products) {
    const hasRelations =
      product._count.orderItems > 0 ||
      product._count.cartItems > 0 ||
      product._count.savedCartItems > 0;

    if (hasRelations) {
      await prisma.product.update({
        where: { id: product.id },
        data: { isActive: false, showInB2b: false, showInB2c: false },
      });
      deactivated.push(product.id);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.designTemplate.deleteMany({ where: { productId: product.id } });
      await tx.pricingModel.deleteMany({ where: { productId: product.id } });
      await tx.product.delete({ where: { id: product.id } });
    });
    deleted.push(product.id);
  }

  revalidateTag(TAGS.PRODUCTS, "max");
  invalidateCategories();

  return NextResponse.json({
    ok: true,
    action,
    deleted: deleted.length,
    deactivated: deactivated.length,
    deletedIds: deleted,
    deactivatedIds: deactivated,
  });
};

export const POST = withObservedRoute("POST /api/admin/products/bulk", POSTHandler);
