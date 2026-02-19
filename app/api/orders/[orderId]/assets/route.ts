import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async (
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Objednávka neexistuje." }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    if (!isAdmin && !order.userId) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    const assets = await prisma.orderAsset.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        fileNameOriginal: true,
        sizeBytes: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("GET /api/orders/[orderId]/assets error:", error);
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    );
  }
}

export const GET = withObservedRoute("GET /api/orders/[orderId]/assets", GETHandler);



