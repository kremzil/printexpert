import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateInvoicePdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * GET /api/orders/[orderId]/invoice
 * Download invoice PDF for an order
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    const { orderId } = await context.params;

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka nenájdená" },
        { status: 404 }
      );
    }

    // Check permissions: user must be owner or admin
    const isOwner = session?.user?.id && order.userId === session.user.id;
    const isAdmin = session?.user?.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Nemáte oprávnenie" },
        { status: 403 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(orderId);

    // Return PDF as Uint8Array for proper Response compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="faktura-${order.orderNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Invoice generation error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa vygenerovať faktúru" },
      { status: 500 }
    );
  }
}
