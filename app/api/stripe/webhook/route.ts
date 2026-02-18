import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const getOrderIdFromSession = (session: Stripe.Checkout.Session) => {
  return session.metadata?.orderId ?? session.client_reference_id ?? null;
};

export async function POST(req: Request) {
  if (!stripe || !stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe nie je nakonfigurovaný" },
      { status: 500 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Chýba Stripe webhook secret" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Chýba Stripe podpis" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Neplatný podpis webhooku";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("Stripe webhook received:", {
    id: event.id,
    type: event.type,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payload = event.data.object as unknown as Prisma.InputJsonValue;
      const initialOrderId = (() => {
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
          const session = event.data.object as Stripe.Checkout.Session;
          return getOrderIdFromSession(session);
        }
        if (event.type.startsWith("payment_intent.")) {
          const intent = event.data.object as Stripe.PaymentIntent;
          return intent.metadata?.orderId ?? null;
        }
        return null;
      })();

      try {
        await tx.stripeEvent.create({
          data: {
            id: event.id,
            type: event.type,
            orderId: initialOrderId,
            payload,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { duplicated: true };
        }
        throw error;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = getOrderIdFromSession(session);
          if (!orderId) break;

          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              status: true,
            },
          });

          if (!order) break;

          const shouldConfirm = order.status !== "CONFIRMED";

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: "PAID",
              paymentProvider: "STRIPE",
              paidAt: new Date(),
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: session.payment_intent
                ? String(session.payment_intent)
                : undefined,
              status: shouldConfirm ? "CONFIRMED" : undefined,
            },
          });

          if (shouldConfirm) {
            await tx.orderStatusHistory.create({
              data: {
                orderId,
                fromStatus: order.status,
                toStatus: "CONFIRMED",
                changedByUserId: null,
                note: `stripe:webhook:${event.id}`,
              },
            });
          }

          break;
        }
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const orderId = paymentIntent.metadata?.orderId ?? null;
          if (!orderId) break;

          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              status: true,
            },
          });

          if (!order) break;

          const shouldConfirm = order.status !== "CONFIRMED";

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: "PAID",
              paymentProvider: "STRIPE",
              paidAt: new Date(),
              stripePaymentIntentId: paymentIntent.id,
              status: shouldConfirm ? "CONFIRMED" : undefined,
            },
          });

          if (shouldConfirm) {
            await tx.orderStatusHistory.create({
              data: {
                orderId,
                fromStatus: order.status,
                toStatus: "CONFIRMED",
                changedByUserId: null,
                note: `stripe:webhook:${event.id}`,
              },
            });
          }

          break;
        }
        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = getOrderIdFromSession(session);
          if (!orderId) break;

          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: { paymentStatus: true },
          });

          if (!order || order.paymentStatus === "PAID") break;

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: "FAILED",
            },
          });

          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const orderId = paymentIntent.metadata?.orderId ?? null;
          if (orderId) {
            await tx.order.updateMany({
              where: {
                id: orderId,
                paymentStatus: { not: "PAID" },
              },
              data: {
                paymentStatus: "FAILED",
                stripePaymentIntentId: paymentIntent.id,
              },
            });
          } else {
            await tx.order.updateMany({
              where: {
                stripePaymentIntentId: paymentIntent.id,
                paymentStatus: { not: "PAID" },
              },
              data: {
                paymentStatus: "FAILED",
              },
            });
          }
          break;
        }
        case "charge.refunded": {
          console.log("Stripe charge.refunded:", event.id);
          break;
        }
        case "refund.updated": {
          const refund = event.data.object as Stripe.Refund;
          if (refund.status === "succeeded" && refund.payment_intent) {
            await tx.order.updateMany({
              where: {
                stripePaymentIntentId: String(refund.payment_intent),
              },
              data: {
                paymentStatus: "REFUNDED",
              },
            });
          } else if (refund.status === "failed") {
            console.warn("Stripe refund failed:", refund.id);
          }
          break;
        }
        default: {
          break;
        }
      }

      return { duplicated: false };
    });

    if (result?.duplicated) {
      console.log("Stripe webhook duplicated event ignored:", event.id);
      return NextResponse.json({ received: true });
    }

    console.log("Stripe webhook processed:", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}
