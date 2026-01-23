import { NextRequest, NextResponse } from "next/server"

import { createSession, hashToken, setSessionCookie } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.redirect(new URL("/auth", request.url))
    }

    const prisma = getPrisma()
    const authToken = await prisma.authToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!authToken) {
      return NextResponse.redirect(new URL("/auth", request.url))
    }

    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    })

    const { rawToken } = await createSession(authToken.userId)
    const response = NextResponse.redirect(new URL("/account", request.url))
    setSessionCookie(response, rawToken)
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.redirect(new URL("/auth", request.url))
  }
}
