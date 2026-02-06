import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"

interface RouteContext {
  params: Promise<{ savedCartId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Pre úpravu košíka sa musíte prihlásiť." },
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
    const body = await request.json().catch(() => ({}))
    const name =
      typeof body?.name === "string" && body.name.trim() !== ""
        ? body.name.trim()
        : null

    const updated = await prisma.savedCart.updateMany({
      where: { id: savedCartId, userId: session.user.id },
      data: { name },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Uložený košík sa nenašiel." },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PATCH /api/saved-carts/[savedCartId] error:", error)
    return NextResponse.json(
      { error: "Chyba pri aktualizácii košíka." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Pre odstránenie košíka sa musíte prihlásiť." },
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
    const deleted = await prisma.savedCart.deleteMany({
      where: { id: savedCartId, userId: session.user.id },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Uložený košík sa nenašiel." },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/saved-carts/[savedCartId] error:", error)
    return NextResponse.json(
      { error: "Chyba pri odstránení košíka." },
      { status: 500 }
    )
  }
}
