import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextResponse } from "next/server"
import { clearCart } from "@/lib/cart"
import { cookies } from "next/headers"

const POSTHandler = async () => {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("cart_session_id")?.value

    await clearCart(sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/cart/clear error:", error)
    return NextResponse.json(
      { error: "Chyba pri vyprázdnení košíka" },
      { status: 500 }
    )
  }
}

export const POST = withObservedRoute("POST /api/cart/clear", POSTHandler);



