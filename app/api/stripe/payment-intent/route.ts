import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculate } from "@/lib/pricing";
import type { Audience, AudienceContext } from "@/lib/audience-shared";
import { Prisma } from "@/lib/generated/prisma";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
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

    const body = await req.json();
    const { orderId, saveCard, customerEmail } = body ?? {};
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Chýba orderId" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Objednávka neexistuje" },
        { status: 404 }
      );
    }

    if (order.userId) {
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const isAdmin = session.user.role === "ADMIN";
      if (!isAdmin && order.userId !== session.user.id) {
        return NextResponse.json({ error: "Zakázané" }, { status: 403 });
      }
    } else {
      if (!customerEmail || typeof customerEmail !== "string") {
        return NextResponse.json(
          { error: "Chýba email zákazníka" },
          { status: 400 }
        );
      }
      if (order.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
        return NextResponse.json({ error: "Zakázané" }, { status: 403 });
      }
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Objednávka je už zaplatená" },
        { status: 400 }
      );
    }

    if (order.stripePaymentIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId
      );
      if (existingIntent.status === "succeeded") {
        return NextResponse.json(
          { error: "Objednávka je už zaplatená" },
          { status: 400 }
        );
      }
      return NextResponse.json({ clientSecret: existingIntent.client_secret });
    }

    const resolvedAudience = resolveAudience(order.audience);
    const audienceContext: AudienceContext = {
      audience: resolvedAudience,
      mode: resolvedAudience,
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

    const shouldSaveCard = Boolean(saveCard);
    let customerId: string | undefined;

    if (shouldSaveCard) {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Uloženie karty vyžaduje prihlásenie" },
          { status: 400 }
        );
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeCustomerId: true, email: true, name: true },
      });

      if (user?.stripeCustomerId) {
        customerId = user.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: order.customerEmail ?? user?.email ?? undefined,
          name: order.customerName ?? user?.name ?? undefined,
          metadata: {
            userId: session.user.id,
          },
        });
        customerId = customer.id;
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeCustomerId: customer.id },
        });
      }
    }

    const setupFutureUsage: Stripe.PaymentIntentCreateParams.SetupFutureUsage | undefined =
      shouldSaveCard ? "off_session" : undefined;

    const baseIntentPayload = {
      amount: amountInCents,
      currency: "eur",
      customer: customerId,
      setup_future_usage: setupFutureUsage,
      receipt_email: order.customerEmail,
      metadata: {
        orderId: order.id,
      },
    };

    let paymentIntent: Stripe.Response<Stripe.PaymentIntent>;

    try {
      paymentIntent = await stripe.paymentIntents.create({
        ...baseIntentPayload,
        payment_method_types: ["card", "link"],
      });
    } catch (error) {
      const stripeError = error as { code?: string };
      if (stripeError?.code !== "payment_method_type_not_enabled") {
        throw error;
      }
      paymentIntent = await stripe.paymentIntents.create({
        ...baseIntentPayload,
        payment_method_types: ["card"],
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        vatAmount,
        total,
        paymentStatus: "PENDING",
        paymentProvider: "STRIPE",
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("POST /api/stripe/payment-intent error:", error);
    return NextResponse.json(
      { error: "Chyba pri vytváraní platby" },
      { status: 500 }
    );
  }
}
