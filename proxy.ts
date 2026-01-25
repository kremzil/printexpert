import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

import {
  AUDIENCE_COOKIE_MAX_AGE_SECONDS,
  AUDIENCE_COOKIE_NAME,
  AUDIENCE_QUERY_PARAM,
  parseAudience,
} from "@/lib/audience-shared"

export async function proxy(request: NextRequest) {
  // NextAuth authorization check
  const session = await auth()
  const { nextUrl } = request
  
  const isLoggedIn = !!session?.user
  const isOnAdmin = nextUrl.pathname.startsWith('/admin')
  const isOnAccount = nextUrl.pathname.startsWith('/account')
  const isOnAuth = nextUrl.pathname.startsWith('/auth')
  
  // Защита админки
  if (isOnAdmin) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/auth', nextUrl))
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }
  
  // Защита личного кабинета
  if (isOnAccount && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth', nextUrl))
  }
  
  // Редирект залогиненных с /auth
  if (isOnAuth && isLoggedIn) {
    return NextResponse.redirect(new URL('/account', nextUrl))
  }

  // Audience mode handling
  const mode = request.nextUrl.searchParams.get(AUDIENCE_QUERY_PARAM)
  const audience = parseAudience(mode)

  if (!audience) {
    return NextResponse.next()
  }

  const shouldRedirect = request.method === "GET" || request.method === "HEAD"
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.searchParams.delete(AUDIENCE_QUERY_PARAM)
  const response = shouldRedirect
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.next()
  response.cookies.set(AUDIENCE_COOKIE_NAME, audience, {
    maxAge: AUDIENCE_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
