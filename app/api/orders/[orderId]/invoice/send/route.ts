import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAndSaveInvoice } from "@/lib/pdf";
import { sendInvoiceEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * POST /api/orders/[orderId]/invoice/send
 * Generate invoice and send to customer email
 */
const POSTHandler = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const session = await auth();
    const { orderId } = await context.params;

    // Admin only
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vyžaduje sa admin oprávnenie" },
        { status: 403 }
      );
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka nenájdená" },
        { status: 404 }
      );
    }

    const existingInvoice = await prisma.orderAsset.findFirst({
      where: { orderId, kind: "INVOICE" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const assetId = existingInvoice?.id ?? await generateAndSaveInvoice(orderId);

    // Send email with invoice
    await sendInvoiceEmail(orderId);

    return NextResponse.json({
      success: true,
      assetId,
      message: `Faktúra bola odoslaná na ${order.customerEmail}`,
    });
  } catch (error) {
    console.error("Invoice send error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa odoslať faktúru" },
      { status: 500 }
    );
  }
}

export const POST = withObservedRoute("POST /api/orders/[orderId]/invoice/send", POSTHandler);



