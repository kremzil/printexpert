import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { Prisma } from "@/lib/generated/prisma"

interface RouteContext {
  params: Promise<{ savedCartId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Pre načítanie košíka sa musíte prihlásiť." },
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

    const { savedCartId } = await context.params

    const savedCart = await prisma.savedCart.findFirst({
      where: { id: savedCartId, userId: session.user.id },
      include: { items: true },
    })

    if (!savedCart) {
      return NextResponse.json(
        { error: "Uložený košík sa nenašiel." },
        { status: 404 }
      )
    }

    const cart = await prisma.cart.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
      select: { id: true },
    })

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    })

    for (const item of savedCart.items) {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
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
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/saved-carts/[savedCartId]/load error:", error)
    return NextResponse.json(
      { error: "Chyba pri načítaní košíka." },
      { status: 500 }
    )
  }
}
