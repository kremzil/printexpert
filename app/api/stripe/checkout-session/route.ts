import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculate } from "@/lib/pricing";
import type { Audience, AudienceContext } from "@/lib/audience-shared";
import { Prisma } from "@/lib/generated/prisma";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const resolveAudience = (value: string): Audience => {
  return value === "b2b" ? "b2b" : "b2c";
};

export async function POST(req: NextRequest) {
  try {
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe nie je nakonfigurovaný" },
        { status: 500 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId } = body ?? {};
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Chýba orderId" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka neexistuje" },
        { status: 404 }
      );
    }

    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Zakázané" }, { status: 403 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Objednávka je už zaplatená" },
        { status: 400 }
      );
    }

    const audienceContext: AudienceContext = {
      audience: resolveAudience(order.audience),
      source: "account",
    };

    let subtotal = new Prisma.Decimal(0);
    let vatAmount = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);

    for (const item of order.items) {
      const selections =
        item.selectedOptions &&
        typeof item.selectedOptions === "object" &&
        !Array.isArray(item.selectedOptions)
          ? (item.selectedOptions as Record<string, Record<string, string>>)
          : undefined;

      const freshPrice = await calculate(
        item.productId,
        {
          quantity: item.quantity,
          width: item.width ? Number(item.width) : null,
          height: item.height ? Number(item.height) : null,
          selections,
        },
        audienceContext
      );

      const itemNet = new Prisma.Decimal(freshPrice.net);
      const itemVat = new Prisma.Decimal(freshPrice.vatAmount);
      const itemGross = new Prisma.Decimal(freshPrice.gross);

      subtotal = subtotal.add(itemNet);
      vatAmount = vatAmount.add(itemVat);
      total = total.add(itemGross);
    }

    const totalNumber = Number(total.toString());
    const amountInCents = Math.round(totalNumber * 100);
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      return NextResponse.json(
        { error: "Nepodarilo sa vypočítať sumu" },
        { status: 400 }
      );
    }

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customerEmail,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Objednávka #${order.orderNumber}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/checkout/success?orderId=${order.id}`,
      cancel_url: `${siteUrl}/checkout/cancel?orderId=${order.id}`,
    });

    if (!stripeSession.url) {
      return NextResponse.json(
        { error: "Stripe nevrátil URL na platbu" },
        { status: 500 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        vatAmount,
        total,
        paymentStatus: "PENDING",
        paymentProvider: "STRIPE",
        stripeCheckoutSessionId: stripeSession.id,
      },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("POST /api/stripe/checkout-session error:", error);
    return NextResponse.json(
      { error: "Chyba pri vytváraní platby" },
      { status: 500 }
    );
  }
}
