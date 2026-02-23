import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const DELETEHandler = async (
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const DELETE = withObservedRoute(
  "DELETE /api/admin/orders/[orderId]",
  DELETEHandler
);

