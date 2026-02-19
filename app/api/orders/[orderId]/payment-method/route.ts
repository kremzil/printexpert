import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

type CheckoutPaymentMethod = "STRIPE" | "BANK_TRANSFER" | "COD";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const PAYMENT_METHODS = new Set<CheckoutPaymentMethod>([
  "STRIPE",
  "BANK_TRANSFER",
  "COD",
]);

const PATCHHandler = async (
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { orderId } = await context.params;
    const session = await auth();
    const body = (await req.json().catch(() => ({}))) as {
      paymentMethod?: CheckoutPaymentMethod;
      customerEmail?: string;
    };

    const paymentMethod = body.paymentMethod;
    if (!paymentMethod || !PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Neplatný spôsob platby." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        customerEmail: true,
        paymentStatus: true,
        total: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka neexistuje." },
        { status: 404 }
      );
    }

    if (order.userId) {
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const isAdmin = session.user.role === "ADMIN";
      if (!isAdmin && session.user.id !== order.userId) {
        return NextResponse.json({ error: "Zakázané" }, { status: 403 });
      }
    } else {
      const customerEmail = String(body.customerEmail ?? "")
        .trim()
        .toLowerCase();
      if (!customerEmail || customerEmail !== order.customerEmail.toLowerCase()) {
        return NextResponse.json({ error: "Zakázané" }, { status: 403 });
      }
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Platbu už nie je možné zmeniť." },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod,
        codAmount: paymentMethod === "COD" ? order.total : null,
        codCurrency: paymentMethod === "COD" ? "EUR" : null,
        ...(paymentMethod !== "STRIPE"
          ? {
              paymentProvider: null,
              paymentStatus: "UNPAID",
              stripePaymentIntentId: null,
              stripeCheckoutSessionId: null,
              paidAt: null,
            }
          : {}),
      },
    });

    return NextResponse.json({ success: true, paymentMethod });
  } catch (error) {
    console.error("PATCH /api/orders/[orderId]/payment-method error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa aktualizovať spôsob platby." },
      { status: 500 }
    );
  }
}

export const PATCH = withObservedRoute("PATCH /api/orders/[orderId]/payment-method", PATCHHandler);



