import { NextResponse } from "next/server"

import { resolveAudienceContext } from "@/lib/audience-context"
import {
  calculate,
  type PriceCalculationParams,
  type PriceResult,
} from "@/lib/pricing"
import { consumeRateLimit } from "@/lib/rate-limit"

type PriceRequest = {
  productId?: string
  params?: PriceCalculationParams
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 60

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const rate = await consumeRateLimit(`price:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    })
    if (!rate.allowed) {
      const response = NextResponse.json(
        { error: "Príliš veľa požiadaviek. Skúste to neskôr." },
        { status: 429 }
      )
      response.headers.set("Retry-After", String(rate.retryAfterSeconds))
      return response
    }
  } catch (error) {
    console.error("Price calculation rate limit error:", error)
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    )
  }

  let payload: PriceRequest
  try {
    payload = (await request.json()) as PriceRequest
  } catch (error) {
    console.error("Price calculation payload error:", error)
    return NextResponse.json(
      { error: "Neplatne data pre vypocet ceny." },
      { status: 400 }
    )
  }

  if (!payload.productId) {
    return NextResponse.json(
      { error: "Chyba produkt." },
      { status: 400 }
    )
  }

  try {
    const audienceContext = await resolveAudienceContext({ request })
    const result: PriceResult = await calculate(
      payload.productId,
      payload.params ?? {},
      audienceContext
    )

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cenu sa nepodarilo vypocitat."
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
