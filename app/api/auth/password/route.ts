import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  getSessionFromRequest,
  hashPassword,
} from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const payloadSchema = z.object({
  password: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
  confirmPassword: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Skontrolujte zadané údaje." },
        { status: 400 }
      )
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json(
        { error: "Heslá sa nezhodujú." },
        { status: 400 }
      )
    }

    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: "Najprv sa prihláste." },
        { status: 401 }
      )
    }

    const prisma = getPrisma()
    const passwordHash = await hashPassword(parsed.data.password)
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Uloženie hesla zlyhalo. Skúste to neskôr." },
      { status: 500 }
    )
  }
}
