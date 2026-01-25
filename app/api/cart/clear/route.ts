import { NextRequest, NextResponse } from "next/server";
import { clearCart } from "@/lib/cart";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session_id")?.value;

    await clearCart(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/cart/clear error:", error);
    return NextResponse.json({ error: "Chyba pri vyprázdnení košíka" }, { status: 500 });
  }
}
