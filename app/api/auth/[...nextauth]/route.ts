import { NextRequest, NextResponse } from "next/server"

import { handlers } from "@/auth"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import {
  getClientIp,
  getClientIpHash,
  getRequestIdOrCreate,
  hashValue,
} from "@/lib/request-utils"
import { consumeRateLimit } from "@/lib/rate-limit"

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_MAGIC = 5
const RATE_LIMIT_MAX_CREDENTIALS = 10

const sha256 = (value: string) => hashValue(value)

const buildErrorUrl = (request: Request, error: string, code?: string) => {
  const origin = new URL(request.url).origin
  const url = new URL("/auth", origin)
  url.searchParams.set("error", error)
  if (code) url.searchParams.set("code", code)
  return url.toString()
}

const jsonRedirect = (request: Request, url: string, status = 200) =>
  NextResponse.json({ url }, { status })

const getHandler = async (request: NextRequest) => handlers.GET(request)

const postHandler = async (request: NextRequest) => {
  const pathname = new URL(request.url).pathname
  const requestId = getRequestIdOrCreate(request)
  const ipHash = getClientIpHash(request)

  try {
    if (pathname === "/api/auth/signin/nodemailer") {
      const ip = getClientIp(request)
      let emailHash = "unknown"

      try {
        const body = await request.clone().formData()
        const email = String(body.get("email") ?? "").trim().toLowerCase()
        if (email) emailHash = sha256(email)
      } catch {
        // If parsing fails, fall back to IP-only key.
      }

      const rate = await consumeRateLimit(`auth:magic:${ip}:${emailHash}`, {
        windowMs: RATE_LIMIT_WINDOW_MS,
        limit: RATE_LIMIT_MAX_MAGIC,
      })

      if (!rate.allowed) {
        logger.warn({
          event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
          requestId,
          scope: "auth.magic_link",
          method: request.method,
          path: pathname,
          ipHash,
          emailHash,
          retryAfterSeconds: rate.retryAfterSeconds,
        })
        const response = jsonRedirect(
          request,
          buildErrorUrl(request, "RateLimit", "magic"),
          429
        )
        response.headers.set("Retry-After", String(rate.retryAfterSeconds))
        return response
      }
    }

    if (pathname === "/api/auth/callback/credentials") {
      const ip = getClientIp(request)
      let emailHash = "unknown"

      try {
        const body = await request.clone().formData()
        const email = String(body.get("email") ?? "").trim().toLowerCase()
        if (email) emailHash = sha256(email)
      } catch {
        // If parsing fails, fall back to IP-only key.
      }

      const rate = await consumeRateLimit(`auth:credentials:${ip}:${emailHash}`, {
        windowMs: RATE_LIMIT_WINDOW_MS,
        limit: RATE_LIMIT_MAX_CREDENTIALS,
      })

      if (!rate.allowed) {
        logger.warn({
          event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
          requestId,
          scope: "auth.credentials",
          method: request.method,
          path: pathname,
          ipHash,
          emailHash,
          retryAfterSeconds: rate.retryAfterSeconds,
        })
        const response = jsonRedirect(
          request,
          buildErrorUrl(request, "RateLimit", "credentials"),
          429
        )
        response.headers.set("Retry-After", String(rate.retryAfterSeconds))
        return response
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown auth rate limit guard error")
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: request.method,
      path: pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
    })
    return jsonRedirect(request, buildErrorUrl(request, "Configuration"), 500)
  }

  return handlers.POST(request)
}

export const GET = withObservedRoute("GET /api/auth/[...nextauth]", getHandler)
export const POST = withObservedRoute("POST /api/auth/[...nextauth]", postHandler)
