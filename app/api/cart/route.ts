import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextResponse } from "next/server"
import { getCart } from "@/lib/cart"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const GETHandler = async () => {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("cart_session_id")?.value

    const cart = await getCart(sessionId)

    return NextResponse.json(
      cart || {
        id: null,
        items: [],
        totals: { subtotal: 0, vatAmount: 0, total: 0 },
      }
    )
  } catch (error) {
    console.error("GET /api/cart error:", error)
    return NextResponse.json(
      { error: "Chyba pri načítaní košíka" },
      { status: 500 }
    )
  }
}

export const GET = withObservedRoute("GET /api/cart", GETHandler);



