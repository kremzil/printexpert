import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { auth } from "@/auth"

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

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

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
  
  const isApiRoute = nextUrl.pathname.startsWith("/api/")
  const isCsrfExcludedRoute = isCsrfExcludedApiPath(nextUrl.pathname)
  const isUnsafeMethod = isUnsafeHttpMethod(request.method)
  const needsCsrfToken = isApiRoute && isUnsafeMethod && !isCsrfExcludedRoute

  if (isApiRoute && isUnsafeMethod && !isCsrfExcludedRoute) {
    const origin = request.headers.get("origin")
    if (origin && origin !== nextUrl.origin) {
      console.warn("proxy blocked request: origin mismatch", {
        method: request.method,
        path: nextUrl.pathname,
        ip: getClientIp(request),
        origin,
        expectedOrigin: nextUrl.origin,
      })
      return NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
    }

    const referer = request.headers.get("referer")
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin
        if (refererOrigin !== nextUrl.origin) {
          console.warn("proxy blocked request: referer mismatch", {
            method: request.method,
            path: nextUrl.pathname,
            ip: getClientIp(request),
            refererOrigin,
            expectedOrigin: nextUrl.origin,
          })
          return NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
        }
      } catch {
        console.warn("proxy blocked request: invalid referer header", {
          method: request.method,
          path: nextUrl.pathname,
          ip: getClientIp(request),
        })
        return NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403 })
      }
    }
  }

  if (needsCsrfToken) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value
    const csrfHeader = request.headers.get("x-csrf-token")

    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      console.warn("proxy blocked request: csrf mismatch", {
        method: request.method,
        path: nextUrl.pathname,
        ip: getClientIp(request),
        userId: session?.user?.id ?? null,
        hasCookie: Boolean(csrfCookie),
        hasHeader: Boolean(csrfHeader),
      })
      return NextResponse.json({ error: "Neplatný CSRF token." }, { status: 403 })
    }
  }

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
    const response = NextResponse.next()
    if (!isApiRoute && (request.method === "GET" || request.method === "HEAD")) {
      ensureCsrfCookie(request, response)
    }
    response.headers.set('x-pathname', nextUrl.pathname)
    return response
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
  response.headers.set('x-pathname', nextUrl.pathname)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
