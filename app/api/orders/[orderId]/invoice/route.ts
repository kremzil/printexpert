import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getInvoiceFromS3 } from "@/lib/s3";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * GET /api/orders/[orderId]/invoice
 * Download invoice PDF for an order
 */
export async function GET(
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

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka nenájdená" },
        { status: 404 }
      );
    }

    const latestInvoice = await prisma.orderAsset.findFirst({
      where: {
        orderId,
        kind: "INVOICE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        bucket: true,
        objectKey: true,
        fileNameOriginal: true,
      },
    });

    if (!latestInvoice) {
      return NextResponse.json(
        { error: "Faktúra ešte nebola vygenerovaná." },
        { status: 404 }
      );
    }

    const pdfBuffer = await getInvoiceFromS3(
      latestInvoice.bucket,
      latestInvoice.objectKey
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${latestInvoice.fileNameOriginal || `faktura-${order.orderNumber}.pdf`}"`,
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
