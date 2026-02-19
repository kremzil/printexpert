import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"

import { resolveAudienceContext } from "@/lib/audience-context"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import { getClientIp, getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils"
import { consumeRateLimit } from "@/lib/rate-limit"
import { QUOTE_REQUEST_MAX_ITEMS } from "@/lib/quote-request-store"

const payloadSchema = z.object({
  contact: z.object({
    name: z.string().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().min(5).max(40),
    company: z.string().min(2).max(160),
  }),
  items: z
    .array(
      z.object({
        slug: z.string().min(1).max(200),
        name: z.string().min(1).max(300),
        configuration: z
          .object({
            quantity: z.number().int().positive().optional(),
            dimensions: z.string().max(80).nullable().optional(),
            options: z
              .array(
                z.object({
                  label: z.string().min(1).max(120),
                  value: z.string().min(1).max(240),
                })
              )
              .max(40)
              .optional(),
            totalPrice: z.number().nonnegative().nullable().optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(QUOTE_REQUEST_MAX_ITEMS),
  note: z.string().max(2000).optional(),
  website: z.string().optional(),
})

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatPrice = (value: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value)

const postHandler = async (request: Request) => {
  const audienceContext = await resolveAudienceContext({ request })
  const requestId = getRequestIdOrCreate(request)
  const ipHash = getClientIpHash(request)
  const responseWithAudience = (response: NextResponse) => {
    response.headers.set("x-audience", audienceContext.audience)
    response.headers.set("x-audience-source", audienceContext.source)
    return response
  }

  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return responseWithAudience(
        NextResponse.json({ error: "Neplatné údaje dopytu." }, { status: 400 })
      )
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      return responseWithAudience(NextResponse.json({ ok: true }))
    }

    const ip = getClientIp(request)
    const rate = await consumeRateLimit(`quote-request:${ip}`, {
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX,
    })
    if (!rate.allowed) {
      logger.warn({
        event: OBS_EVENT.SECURITY_RATE_LIMIT_DENIED,
        requestId,
        scope: "quote_request",
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
      return responseWithAudience(response)
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM
    const smtpTo = process.env.SMTP_TO ?? smtpFrom

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !smtpTo) {
      return responseWithAudience(
        NextResponse.json({ error: "SMTP not configured" }, { status: 500 })
      )
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

    const origin = new URL(request.url).origin
    const audienceLabel = audienceContext.audience.toUpperCase()
    const { contact, items } = parsed.data
    const note = parsed.data.note?.trim()

    const itemLinesText = items
      .map((item, index) => {
        const configLines: string[] = []
        if (item.configuration?.quantity) {
          configLines.push(`   Množstvo: ${item.configuration.quantity} ks`)
        }
        if (item.configuration?.dimensions) {
          configLines.push(`   Rozmery: ${item.configuration.dimensions}`)
        }
        if (
          item.configuration?.totalPrice !== null &&
          item.configuration?.totalPrice !== undefined
        ) {
          configLines.push(`   Cena: ${formatPrice(item.configuration.totalPrice)}`)
        }
        if (item.configuration?.options?.length) {
          configLines.push("   Konfigurácia:")
          for (const option of item.configuration.options) {
            configLines.push(`   - ${option.label}: ${option.value}`)
          }
        }
        return [
          `${index + 1}. ${item.name}`,
          `   ${origin}/product/${item.slug}`,
          ...configLines,
        ].join("\n")
      })
      .join("\n")
    const itemLinesHtml = items
      .map((item, index) => {
        const configHtml: string[] = []
        if (item.configuration?.quantity) {
          configHtml.push(
            `<div><strong>Množstvo:</strong> ${item.configuration.quantity} ks</div>`
          )
        }
        if (item.configuration?.dimensions) {
          configHtml.push(
            `<div><strong>Rozmery:</strong> ${escapeHtml(item.configuration.dimensions)}</div>`
          )
        }
        if (
          item.configuration?.totalPrice !== null &&
          item.configuration?.totalPrice !== undefined
        ) {
          configHtml.push(
            `<div><strong>Cena:</strong> ${escapeHtml(formatPrice(item.configuration.totalPrice))}</div>`
          )
        }
        if (item.configuration?.options?.length) {
          const optionsHtml = item.configuration.options
            .map(
              (option) =>
                `<li>${escapeHtml(option.label)}: ${escapeHtml(option.value)}</li>`
            )
            .join("")
          configHtml.push(`<div><strong>Konfigurácia:</strong><ul>${optionsHtml}</ul></div>`)
        }

        return `<li>${index + 1}. ${escapeHtml(item.name)}<br/><a href="${origin}/product/${encodeURIComponent(item.slug)}">${origin}/product/${escapeHtml(item.slug)}</a>${configHtml.length > 0 ? `<div style="margin-top:6px">${configHtml.join("")}</div>` : ""}</li>`
      })
      .join("")

    await transport.sendMail({
      from: smtpFrom,
      to: smtpTo,
      replyTo: contact.email,
      subject: `Nový dopyt na cenovú ponuku (${audienceLabel})`,
      text: [
        `Režim: ${audienceLabel} (zdroj: ${audienceContext.source})`,
        `Meno: ${contact.name}`,
        `E-mail: ${contact.email}`,
        `Telefón: ${contact.phone}`,
        `Spoločnosť: ${contact.company}`,
        "",
        "Produkty:",
        itemLinesText,
        "",
        note ? `Poznámka:\n${note}` : "Poznámka: —",
      ].join("\n"),
      html: [
        `<p><strong>Režim:</strong> ${audienceLabel} (zdroj: ${escapeHtml(audienceContext.source)})</p>`,
        `<p><strong>Meno:</strong> ${escapeHtml(contact.name)}<br/>`,
        `<strong>E-mail:</strong> ${escapeHtml(contact.email)}<br/>`,
        `<strong>Telefón:</strong> ${escapeHtml(contact.phone)}<br/>`,
        `<strong>Spoločnosť:</strong> ${escapeHtml(contact.company)}</p>`,
        "<p><strong>Produkty:</strong></p>",
        `<ol>${itemLinesHtml}</ol>`,
        `<p><strong>Poznámka:</strong><br/>${note ? escapeHtml(note).replace(/\n/g, "<br/>") : "—"}</p>`,
      ].join(""),
    })

    return responseWithAudience(NextResponse.json({ ok: true }))
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown quote request route error")
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash,
      errorName: err.name,
      errorMessage: err.message,
    })
    return responseWithAudience(
      NextResponse.json({ error: "Server error" }, { status: 500 })
    )
  }
}

export const POST = withObservedRoute("POST /api/quote-request", postHandler)
