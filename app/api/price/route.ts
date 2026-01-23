import { NextResponse } from "next/server"

import { resolveAudienceContext } from "@/lib/audience-context"
import {
  calculate,
  type PriceCalculationParams,
  type PriceResult,
} from "@/lib/pricing"

type PriceRequest = {
  productId?: string
  params?: PriceCalculationParams
}

export async function POST(request: Request) {
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
