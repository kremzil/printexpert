import { NextRequest, NextResponse } from "next/server"

import {
  clearSessionCookie,
  hashToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })

  try {
    const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (rawToken) {
      const prisma = getPrisma()
      await prisma.session.deleteMany({
        where: { sessionToken: hashToken(rawToken) },
      })
    }
  } catch (error) {
    console.error(error)
  }

  clearSessionCookie(response)
  return response
}
