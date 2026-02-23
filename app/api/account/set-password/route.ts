import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { hashPassword } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const schema = z.object({
  password: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
  confirmPassword: z.string().min(8),
})

const POSTHandler = async (request: Request) => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Skontrolujte zadané údaje." }, { status: 400 })
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json({ error: "Heslá sa nezhodujú." }, { status: 400 })
    }

    const prisma = getPrisma()
    const passwordHash = await hashPassword(parsed.data.password)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash,
        passwordMigrated: true,
      },
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

export const POST = withObservedRoute("POST /api/account/set-password", POSTHandler);



