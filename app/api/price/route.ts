import { NextResponse } from "next/server"

import { resolveAudienceContext } from "@/lib/audience-context"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import {
  calculate,
  type PriceCalculationParams,
  type PriceResult,
} from "@/lib/pricing"
import { getClientIp, getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils"
import { consumeRateLimit } from "@/lib/rate-limit"

type PriceRequest = {
  productId?: string
  params?: PriceCalculationParams
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 60

const postHandler = async (request: Request) => {
  const requestId = getRequestIdOrCreate(request)
  const ipHash = getClientIpHash(request)
  const ip = getClientIp(request)
  try {
    const rate = await consumeRateLimit(`price:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    })
    if (!rate.allowed) {
      logger.warn({
        event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
        requestId,
        scope: "price",
        method: request.method,
        path: new URL(request.url).pathname,
        ipHash,
        retryAfterSeconds: rate.retryAfterSeconds,
      })
      const response = NextResponse.json(
        { error: "Príliš veľa požiadaviek. Skúste to neskôr." },
        { status: 429 }
      )
      response.headers.set("Retry-After", String(rate.retryAfterSeconds))
      return response
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown price rate limit error")
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
      scope: "price.rate_limit_guard",
    })
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    )
  }

  let payload: PriceRequest
  try {
    payload = (await request.json()) as PriceRequest
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown price payload error")
    logger.warn({
      event: OBS_EVENT.HTTP_REQUEST_COMPLETED,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash,
      status: 400,
      reason: "invalid_payload",
      errorMessage: err.message,
    })
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

export const POST = withObservedRoute("POST /api/price", postHandler)
