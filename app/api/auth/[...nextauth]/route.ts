import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { handlers } from "@/auth"
import { consumeRateLimit } from "@/lib/rate-limit"

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_MAGIC = 5
const RATE_LIMIT_MAX_CREDENTIALS = 10

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

const buildErrorUrl = (request: Request, error: string, code?: string) => {
  const origin = new URL(request.url).origin
  const url = new URL("/auth", origin)
  url.searchParams.set("error", error)
  if (code) url.searchParams.set("code", code)
  return url.toString()
}

const jsonRedirect = (request: Request, url: string, status = 200) =>
  NextResponse.json({ url }, { status })

export const GET = handlers.GET

export async function POST(request: NextRequest) {
  const pathname = new URL(request.url).pathname

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
    console.error("auth rate limit guard error:", error)
    return jsonRedirect(request, buildErrorUrl(request, "Configuration"), 500)
  }

  return handlers.POST(request)
}
