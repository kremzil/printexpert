import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAndSaveInvoice } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * POST /api/orders/[orderId]/invoice/create
 * Generate invoice PDF and store as order asset (no email)
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    const { orderId } = await context.params;

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vyžaduje sa admin oprávnenie" },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
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

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Faktúra už existuje." },
        { status: 409 }
      );
    }

    const assetId = await generateAndSaveInvoice(orderId);

    return NextResponse.json({
      success: true,
      assetId,
      message: "Faktúra bola vygenerovaná.",
    });
  } catch (error) {
    console.error("Invoice create error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa vygenerovať faktúru" },
      { status: 500 }
    );
  }
}
