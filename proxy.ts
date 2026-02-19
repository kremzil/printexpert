import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { auth } from "@/auth"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import {
  getClientIpHash,
  getRequestIdOrCreate,
  REQUEST_ID_HEADER,
} from "@/lib/request-utils"

import {
  AUDIENCE_COOKIE_MAX_AGE_SECONDS,
  AUDIENCE_COOKIE_NAME,
  AUDIENCE_QUERY_PARAM,
  parseAudience,
} from "@/lib/audience-shared"
import {
  CSRF_COOKIE_NAME,
  isCsrfExcludedApiPath,
  isUnsafeHttpMethod,
} from "@/lib/csrf"

const CSRF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const createCsrfToken = () => randomBytes(32).toString("base64url")

const ensureCsrfCookie = (request: NextRequest, response: NextResponse) => {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (existing) return existing

  const token = createCsrfToken()
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
  return token
}

export async function proxy(request: NextRequest) {
  // NextAuth authorization check
  const session = await auth()
  const { nextUrl } = request
  const requestId = getRequestIdOrCreate(request)
  const ipHash = getClientIpHash(request)

  const withRequestMeta = (response: NextResponse) => {
    response.headers.set("x-pathname", nextUrl.pathname)
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
  
  const isApiRoute = nextUrl.pathname.startsWith("/api/")
  const isCsrfExcludedRoute = isCsrfExcludedApiPath(nextUrl.pathname)
  const isUnsafeMethod = isUnsafeHttpMethod(request.method)
  const needsCsrfToken = isApiRoute && isUnsafeMethod && !isCsrfExcludedRoute

  if (isApiRoute && isUnsafeMethod && !isCsrfExcludedRoute) {
    const origin = request.headers.get("origin")
    if (origin && origin !== nextUrl.origin) {
      logger.warn({
        event: OBS_EVENT.SECURITY_ORIGIN_BLOCKED,
        requestId,
        method: request.method,
        path: nextUrl.pathname,
        ipHash,
        origin,
        expectedOrigin: nextUrl.origin,
        userId: session?.user?.id ?? null,
      })
      return withRequestMeta(
        NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
      )
    }

    const referer = request.headers.get("referer")
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin
        if (refererOrigin !== nextUrl.origin) {
          logger.warn({
            event: OBS_EVENT.SECURITY_ORIGIN_BLOCKED,
            requestId,
            method: request.method,
            path: nextUrl.pathname,
            ipHash,
            refererOrigin,
            expectedOrigin: nextUrl.origin,
            userId: session?.user?.id ?? null,
          })
          return withRequestMeta(
            NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
          )
        }
      } catch {
        logger.warn({
          event: OBS_EVENT.SECURITY_ORIGIN_BLOCKED,
          requestId,
          method: request.method,
          path: nextUrl.pathname,
          ipHash,
          reason: "invalid_referer_header",
          userId: session?.user?.id ?? null,
        })
        return withRequestMeta(
          NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
        )
      }
    }
  }

  if (needsCsrfToken) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value
    const csrfHeader = request.headers.get("x-csrf-token")

    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      logger.warn({
        event: OBS_EVENT.SECURITY_CSRF_BLOCKED,
        requestId,
        method: request.method,
        path: nextUrl.pathname,
        ipHash,
        userId: session?.user?.id ?? null,
        hasCookie: Boolean(csrfCookie),
        hasHeader: Boolean(csrfHeader),
      })
      return withRequestMeta(
        NextResponse.json({ error: "Neplatný CSRF token." }, { status: 403 })
      )
    }
  }

  const isLoggedIn = !!session?.user
  const isOnAdmin = nextUrl.pathname.startsWith('/admin')
  const isOnAccount = nextUrl.pathname.startsWith('/account')
  const isOnAuth = nextUrl.pathname.startsWith('/auth')
  
  // Защита админки
  if (isOnAdmin) {
    if (!isLoggedIn) {
      return withRequestMeta(NextResponse.redirect(new URL('/auth', nextUrl)))
    }
    if (session.user.role !== 'ADMIN') {
      return withRequestMeta(NextResponse.redirect(new URL('/', nextUrl)))
    }
  }
  
  // Защита личного кабинета
  if (isOnAccount && !isLoggedIn) {
    return withRequestMeta(NextResponse.redirect(new URL('/auth', nextUrl)))
  }
  
  // Редирект залогиненных с /auth
  if (isOnAuth && isLoggedIn) {
    return withRequestMeta(NextResponse.redirect(new URL('/account', nextUrl)))
  }

  // Audience mode handling
  const mode = request.nextUrl.searchParams.get(AUDIENCE_QUERY_PARAM)
  const audience = parseAudience(mode)

  if (!audience) {
    const response = NextResponse.next()
    if (!isApiRoute && (request.method === "GET" || request.method === "HEAD")) {
      ensureCsrfCookie(request, response)
    }
    return withRequestMeta(response)
  }

  const shouldRedirect = request.method === "GET" || request.method === "HEAD"
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.searchParams.delete(AUDIENCE_QUERY_PARAM)
  const response = shouldRedirect
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.next()
  if (!isApiRoute && (request.method === "GET" || request.method === "HEAD")) {
    ensureCsrfCookie(request, response)
  }
  response.cookies.set(AUDIENCE_COOKIE_NAME, audience, {
    maxAge: AUDIENCE_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
  return withRequestMeta(response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
