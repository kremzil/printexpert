import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAndSaveInvoice, type InvoiceGenerationOverrides } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeLine = (value: unknown) => {
  if (!isRecord(value)) return null;

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const quantity = Number(value.quantity);
  const unitPrice = Number(value.unitPrice);
  const vatRatePercent = Number(value.vatRatePercent);

  if (!name) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) return null;

  return {
    name,
    quantity,
    unitPrice,
    vatRate: vatRatePercent / 100,
  };
};

const parseInvoiceOverrides = (payload: unknown): InvoiceGenerationOverrides | undefined => {
  if (!isRecord(payload)) return undefined;

  const overrides: InvoiceGenerationOverrides = {};

  if (typeof payload.invoicePrefix === "string" && payload.invoicePrefix.trim()) {
    overrides.invoicePrefix = payload.invoicePrefix.trim().slice(0, 20);
  }

  if (typeof payload.invoiceNumber === "string" && payload.invoiceNumber.trim()) {
    overrides.invoiceNumber = payload.invoiceNumber.trim().slice(0, 64);
  }

  if (typeof payload.issueDate === "string" && payload.issueDate.trim()) {
    overrides.issueDate = payload.issueDate.trim();
  }

  if (typeof payload.taxDate === "string" && payload.taxDate.trim()) {
    overrides.taxDate = payload.taxDate.trim();
  }

  if (typeof payload.dueDate === "string" && payload.dueDate.trim()) {
    overrides.dueDate = payload.dueDate.trim();
  }

  if (Array.isArray(payload.items)) {
    const lines = payload.items
      .map(normalizeLine)
      .filter((line): line is NonNullable<ReturnType<typeof normalizeLine>> => Boolean(line));

    if (lines.length > 0) {
      overrides.items = lines;
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

/**
 * POST /api/orders/[orderId]/invoice/create
 * Generate invoice PDF and store as order asset (no email)
 */
const POSTHandler = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const session = await auth();
    const { orderId } = await context.params;
    const forceRegenerate = ["1", "true", "yes"].includes(
      request.nextUrl.searchParams.get("force")?.toLowerCase() ?? ""
    );
    const payload = await request.json().catch(() => null);
    const overrides = parseInvoiceOverrides(payload);

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

    if (existingInvoice && !forceRegenerate) {
      return NextResponse.json(
        { error: "Faktúra už existuje." },
        { status: 409 }
      );
    }

    const assetId = await generateAndSaveInvoice(orderId, overrides);

    return NextResponse.json({
      success: true,
      assetId,
      message: forceRegenerate
        ? "Faktúra bola znovu vygenerovaná."
        : "Faktúra bola vygenerovaná.",
    });
  } catch (error) {
    console.error("Invoice create error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa vygenerovať faktúru" },
      { status: 500 }
    );
  }
}

export const POST = withObservedRoute("POST /api/orders/[orderId]/invoice/create", POSTHandler);



