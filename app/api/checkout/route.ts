import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { cookies } from "next/headers";
import { NotificationService } from "@/lib/notifications";
import { consumeRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = await consumeRateLimit(`checkout:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    });
    if (!rate.allowed) {
      const response = NextResponse.json(
        { error: "Príliš veľa objednávok. Skúste to neskôr." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(rate.retryAfterSeconds));
      return response;
    }

    const body = await req.json();
    const { customerName, customerEmail, customerPhone, shippingAddress, billingAddress, notes } =
      body;

    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: "Meno a email sú povinné" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session_id")?.value;

    const order = await createOrder(
      {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        billingAddress,
        notes,
      },
      sessionId
    );

    // Cookie корзины удаляется на клиенте после успешной оплаты

    NotificationService.sendOrderCreated(order.id).catch((error) => {
      console.error("Failed to send order created notification:", error);
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST /api/checkout error:", error);
    const message = error instanceof Error ? error.message : "Chyba pri vytváraní objednávky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
