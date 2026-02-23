import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { cookies } from "next/headers";
import { NotificationService } from "@/lib/notifications";
import { OBS_EVENT } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { getClientIp, getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getShopSettings } from "@/lib/shop-settings";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const postHandler = async (req: NextRequest) => {
  const requestId = getRequestIdOrCreate(req);
  const ipHash = getClientIpHash(req);
  try {
    const ip = getClientIp(req);
    const rate = await consumeRateLimit(`checkout:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    });
    if (!rate.allowed) {
      logger.warn({
        event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
        requestId,
        scope: "checkout",
        method: req.method,
        path: new URL(req.url).pathname,
        ipHash,
        retryAfterSeconds: rate.retryAfterSeconds,
      });
      const response = NextResponse.json(
        { error: "Príliš veľa objednávok. Skúste to neskôr." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(rate.retryAfterSeconds));
      return response;
    }

    const body = await req.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      billingAddress,
      notes,
      deliveryMethod,
      paymentMethod,
      dpdProduct,
      pickupPoint,
    } =
      body;

    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: "Meno a email sú povinné" },
        { status: 400 }
      );
    }

    const settings = await getShopSettings();
    if (deliveryMethod === "DPD_PICKUP" && !settings.dpdSettings.pickupPointEnabled) {
      return NextResponse.json(
        { error: "DPD Pickup point je momentálne nedostupný." },
        { status: 400 }
      );
    }
    if (deliveryMethod === "DPD_PICKUP" && !pickupPoint?.parcelShopId) {
      return NextResponse.json(
        { error: "Vyberte odberné miesto DPD." },
        { status: 400 }
      );
    }
    if (paymentMethod === "COD") {
      if (deliveryMethod === "PERSONAL_PICKUP") {
        return NextResponse.json(
          { error: "Dobierka nie je dostupná pre osobný odber." },
          { status: 400 }
        );
      }
      if (!settings.paymentSettings.codEnabled) {
        return NextResponse.json(
          { error: "Dobierka nie je dostupná." },
          { status: 400 }
        );
      }
      if (
        (deliveryMethod === "DPD_PICKUP" && !settings.paymentSettings.codForPickup) ||
        ((deliveryMethod ?? "DPD_COURIER") === "DPD_COURIER" &&
          !settings.paymentSettings.codForCourier)
      ) {
        return NextResponse.json(
          { error: "Dobierka nie je dostupná pre vybraný spôsob doručenia." },
          { status: 400 }
        );
      }
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
        deliveryMethod,
        paymentMethod,
        dpdProduct,
        pickupPoint,
        notes,
      },
      sessionId
    );

    // Cookie корзины удаляется на клиенте после успешной оплаты

    NotificationService.sendOrderCreated(order.id).catch((error) => {
      const err =
        error instanceof Error
          ? error
          : new Error("Unknown order created notification error");
      logger.error({
        event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
        requestId,
        method: req.method,
        path: new URL(req.url).pathname,
        ipHash,
        scope: "checkout.notification.order_created",
        errorName: err.name,
        errorMessage: err.message,
      });
    });
    NotificationService.sendAdminOrderCreated(order.id).catch((error) => {
      const err =
        error instanceof Error
          ? error
          : new Error("Unknown admin order created notification error");
      logger.error({
        event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
        requestId,
        method: req.method,
        path: new URL(req.url).pathname,
        ipHash,
        scope: "checkout.notification.order_created_admin",
        errorName: err.name,
        errorMessage: err.message,
      });
    });

    return NextResponse.json(order);
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown checkout route error");
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: req.method,
      path: new URL(req.url).pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
    });
    const message = error instanceof Error ? error.message : "Chyba pri vytváraní objednávky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const POST = withObservedRoute("POST /api/checkout", postHandler);
