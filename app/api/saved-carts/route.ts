import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getCart } from "@/lib/cart"
import { resolveAudienceContext } from "@/lib/audience-context"
import { Prisma } from "@/lib/generated/prisma"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Pre uloženie košíka sa musíte prihlásiť." },
        { status: 401 }
      )
    }

    const audienceContext = await resolveAudienceContext({ request })
    if (audienceContext.mode !== "b2b") {
      return NextResponse.json(
        { error: "Uložené košíky sú dostupné len pre B2B zákazníkov." },
        { status: 403 }
      )
    }

    const cookieStore = await cookies()
    const sessionId = cookieStore.get("cart_session_id")?.value
    const cart = await getCart(sessionId)

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Košík je prázdny." }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const name =
      typeof body?.name === "string" && body.name.trim() !== ""
        ? body.name.trim()
        : null

    const savedCart = await prisma.savedCart.create({
      data: {
        userId: session.user.id,
        name,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            width: item.width,
            height: item.height,
            selectedOptions: item.selectedOptions
              ? (item.selectedOptions as unknown as Prisma.InputJsonValue)
              : undefined,
            priceSnapshot: item.priceSnapshot
              ? (item.priceSnapshot as unknown as Prisma.InputJsonValue)
              : undefined,
          })),
        },
      },
      select: { id: true },
    })

    return NextResponse.json({ id: savedCart.id })
  } catch (error) {
    console.error("POST /api/saved-carts error:", error)
    return NextResponse.json(
      { error: "Chyba pri ukladaní košíka." },
      { status: 500 }
    )
  }
}
