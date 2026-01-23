import { NextResponse } from "next/server"
import { z } from "zod"

import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const payloadSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov."),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Skontrolujte zadané údaje." },
        { status: 400 }
      )
    }

    const email = parsed.data.email.trim().toLowerCase()
    const prisma = getPrisma()
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Nesprávny e-mail alebo heslo." },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(
      parsed.data.password,
      user.passwordHash
    )
    if (!isValid) {
      return NextResponse.json(
        { error: "Nesprávny e-mail alebo heslo." },
        { status: 401 }
      )
    }

    const { rawToken } = await createSession(user.id)
    const response = NextResponse.json({ ok: true })
    setSessionCookie(response, rawToken)
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Prihlásenie zlyhalo. Skúste to neskôr." },
      { status: 500 }
    )
  }
}
