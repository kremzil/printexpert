import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { hashPassword } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import { withObservedRoute } from "@/lib/observability/with-observed-route"

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
  confirmPassword: z.string().min(8),
})

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

const POSTHandler = async (request: Request) => {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Skontrolujte zadané údaje." },
        { status: 400 }
      )
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json({ error: "Heslá sa nezhodujú." }, { status: 400 })
    }

    const prisma = getPrisma()
    const tokenHash = hashToken(parsed.data.token)
    const now = new Date()

    const authToken = await prisma.authToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!authToken) {
      return NextResponse.json(
        { error: "Odkaz na obnovenie hesla je neplatný alebo expiroval." },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(parsed.data.password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: authToken.userId },
        data: {
          passwordHash,
          passwordMigrated: true,
        },
      }),
      prisma.authToken.update({
        where: { id: authToken.id },
        data: {
          usedAt: now,
        },
      }),
      prisma.authToken.updateMany({
        where: {
          userId: authToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Obnovenie hesla zlyhalo. Skúste to neskôr." },
      { status: 500 }
    )
  }
}

export const POST = withObservedRoute(
  "POST /api/account/password-reset/confirm",
  POSTHandler
)

