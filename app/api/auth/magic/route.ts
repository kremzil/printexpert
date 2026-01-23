import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"

import {
  createRandomToken,
  hashToken,
  MAGIC_LINK_TTL_MINUTES,
} from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const payloadSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
})

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

const checkRateLimit = (key: string) => {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }
  entry.count += 1
  return true
}

const getBaseUrl = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  const origin =
    configured ??
    request.headers.get("origin") ??
    (() => {
      try {
        return new URL(request.url).origin
      } catch {
        return "http://localhost:3000"
      }
    })()
  return origin.replace(/\/+$/, "")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Zadajte platný e-mail." },
        { status: 400 }
      )
    }

    const email = parsed.data.email.trim().toLowerCase()
    const ip = getClientIp(request)
    const rateKey = `${ip}:${email}`
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Príliš veľa pokusov. Skúste to neskôr." },
        { status: 429 }
      )
    }

    const prisma = getPrisma()
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    })

    const rawToken = createRandomToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(
      Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000
    )

    await prisma.authToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const baseUrl = getBaseUrl(request)
    const magicUrl = `${baseUrl}/auth/magic?token=${encodeURIComponent(
      rawToken
    )}`

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
      return NextResponse.json(
        { error: "E-mailové služby nie sú nastavené." },
        { status: 500 }
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

    await transport.sendMail({
      from: smtpFrom,
      to: email,
      subject: "Prihlásenie do PrintExpert",
      text: `Dobrý deň,\n\nkliknite na tento odkaz pre prihlásenie:\n${magicUrl}\n\nOdkaz je platný ${MAGIC_LINK_TTL_MINUTES} minút. Ak ste o prihlásenie nepožiadali, ignorujte tento e-mail.\n`,
      html: `<p>Dobrý deň,</p><p>Kliknite na tento odkaz pre prihlásenie:</p><p><a href="${magicUrl}">${magicUrl}</a></p><p>Odkaz je platný ${MAGIC_LINK_TTL_MINUTES} minút. Ak ste o prihlásenie nepožiadali, ignorujte tento e-mail.</p>`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Niečo sa pokazilo. Skúste to neskôr." },
      { status: 500 }
    )
  }
}
