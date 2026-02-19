import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"

import { resolveAudienceContext } from "@/lib/audience-context"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import { getClientIp, getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils"
import { consumeRateLimit } from "@/lib/rate-limit"

const payloadSchema = z.object({
  name: z.string().min(2),
  email: z.string().trim().toLowerCase().email(),
  message: z.string().min(10),
  company: z.string().optional(),
})

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5

const postHandler = async (request: Request) => {
  const audienceContext = await resolveAudienceContext({ request })
  const requestId = getRequestIdOrCreate(request)
  const ipHash = getClientIpHash(request)

  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      )
      response.headers.set("x-audience", audienceContext.audience)
      response.headers.set("x-audience-source", audienceContext.source)
      return response
    }

    if (parsed.data.company && parsed.data.company.trim().length > 0) {
      const response = NextResponse.json({ ok: true })
      response.headers.set("x-audience", audienceContext.audience)
      response.headers.set("x-audience-source", audienceContext.source)
      return response
    }

    const ip = getClientIp(request)
    const rate = await consumeRateLimit(`contact:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    })
    if (!rate.allowed) {
      logger.warn({
        event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
        requestId,
        scope: "contact",
        method: request.method,
        path: new URL(request.url).pathname,
        ipHash,
        retryAfterSeconds: rate.retryAfterSeconds,
      })
      const response = NextResponse.json(
        { error: "Príliš veľa pokusov. Skúste to neskôr." },
        { status: 429 }
      )
      response.headers.set("Retry-After", String(rate.retryAfterSeconds))
      response.headers.set("x-audience", audienceContext.audience)
      response.headers.set("x-audience-source", audienceContext.source)
      return response
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM
    const smtpTo = process.env.SMTP_TO ?? smtpFrom

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !smtpTo) {
      const response = NextResponse.json(
        { error: "SMTP not configured" },
        { status: 500 }
      )
      response.headers.set("x-audience", audienceContext.audience)
      response.headers.set("x-audience-source", audienceContext.source)
      return response
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const { name, message } = parsed.data
    const email = parsed.data.email.trim().toLowerCase()
    const audienceLabel = audienceContext.audience.toUpperCase()
    await transport.sendMail({
      from: smtpFrom,
      to: smtpTo,
      replyTo: email,
      subject: `Nová správa z kontaktného formulára (${audienceLabel})`,
      text: `Meno: ${name}\nE-mail: ${email}\nRežim: ${audienceLabel} (zdroj: ${audienceContext.source})\n\nSpráva:\n${message}`,
      html: `<p><strong>Meno:</strong> ${name}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Režim:</strong> ${audienceLabel} (zdroj: ${audienceContext.source})</p><p><strong>Správa:</strong></p><p>${message.replace(/\n/g, "<br />")}</p>`,
    })

    const response = NextResponse.json({ ok: true })
    response.headers.set("x-audience", audienceContext.audience)
    response.headers.set("x-audience-source", audienceContext.source)
    return response
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown contact route error")
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
    })
    const response = NextResponse.json({ error: "Server error" }, { status: 500 })
    response.headers.set("x-audience", audienceContext.audience)
    response.headers.set("x-audience-source", audienceContext.source)
    return response
  }
}

export const POST = withObservedRoute("POST /api/contact", postHandler)
