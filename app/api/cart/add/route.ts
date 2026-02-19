import { NextRequest, NextResponse } from "next/server";
import { addToCart } from "@/lib/cart";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { OBS_EVENT } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils";

const postHandler = async (req: NextRequest) => {
  const requestId = getRequestIdOrCreate(req);
  const ipHash = getClientIpHash(req);
  try {
    const body = await req.json();
    const { productId, quantity, width, height, selectedOptions, priceSnapshot, designData } = body;

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "productId a quantity sú povinné" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    let sessionId = cookieStore.get("cart_session_id")?.value;

    // Vytvoríme session ID pre hosťa, ak neexistuje
    if (!sessionId) {
      sessionId = randomBytes(32).toString("hex");
      cookieStore.set("cart_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 dní
      });
    }

    const cartItem = await addToCart(
      {
        productId,
        quantity,
        width,
        height,
        selectedOptions,
        priceSnapshot,
        designData,
      },
      sessionId
    );

    return NextResponse.json(cartItem);
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown cart add route error");
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: req.method,
      path: new URL(req.url).pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
    });
    return NextResponse.json(
      { error: "Chyba pri pridávaní do košíka" },
      { status: 500 }
    );
  }
};

export const POST = withObservedRoute("POST /api/cart/add", postHandler);
