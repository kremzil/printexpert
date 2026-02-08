import { NextRequest, NextResponse } from "next/server";
import { addToCart } from "@/lib/cart";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
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
    console.error("POST /api/cart/add error:", error);
    return NextResponse.json(
      { error: "Chyba pri pridávaní do košíka" },
      { status: 500 }
    );
  }
}
