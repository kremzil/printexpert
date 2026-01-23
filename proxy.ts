import { NextRequest, NextResponse } from "next/server"

import {
  AUDIENCE_COOKIE_MAX_AGE_SECONDS,
  AUDIENCE_COOKIE_NAME,
  AUDIENCE_QUERY_PARAM,
  parseAudience,
} from "@/lib/audience-shared"

export function proxy(request: NextRequest) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
