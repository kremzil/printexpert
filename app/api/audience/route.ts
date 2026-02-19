import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextResponse } from "next/server"

import {
  AUDIENCE_COOKIE_MAX_AGE_SECONDS,
  AUDIENCE_COOKIE_NAME,
  parseAudience,
} from "@/lib/audience-shared"

type AudiencePayload = {
  mode?: string
}

const POSTHandler = async (request: Request) => {
  let payload: AudiencePayload

  try {
    payload = (await request.json()) as AudiencePayload
  } catch {
    return NextResponse.json(
      { error: "Neplatné dáta pre režim." },
      { status: 400 }
    )
  }

  const audience = parseAudience(payload.mode)
  if (!audience) {
    return NextResponse.json(
      { error: "Neplatný režim." },
      { status: 422 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUDIENCE_COOKIE_NAME, audience, {
    maxAge: AUDIENCE_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })

  return response
}

export const POST = withObservedRoute("POST /api/audience", POSTHandler);



