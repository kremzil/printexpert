import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

type BulkDeleteBody = {
  orderIds?: string[];
};

const POSTHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as BulkDeleteBody | null;
  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "Nie sú vybrané žiadne objednávky." }, { status: 400 });
  }

  const existing = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true },
  });
  const existingIds = existing.map((order) => order.id);

  if (existingIds.length === 0) {
    return NextResponse.json({ error: "Objednávky neboli nájdené." }, { status: 404 });
  }

  const result = await prisma.order.deleteMany({
    where: { id: { in: existingIds } },
  });

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    missing: orderIds.length - existingIds.length,
  });
};

export const POST = withObservedRoute(
  "POST /api/admin/orders/bulk-delete",
  POSTHandler
);

