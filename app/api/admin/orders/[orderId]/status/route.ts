import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/generated/prisma";
import { NotificationService } from "@/lib/notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    const { orderId } = await params;

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!currentOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      if (currentOrder.status !== status) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: currentOrder.status,
            toStatus: status as OrderStatus,
            changedByUserId: session.user.id,
          },
        });
      }

      return updated;
    });

    if (currentOrder.status !== status) {
      NotificationService.sendOrderStatusChanged(
        orderId,
        currentOrder.status,
        status as OrderStatus
      ).catch((error) => {
        console.error("Failed to send status change notification:", error);
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
