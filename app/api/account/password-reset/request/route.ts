import { randomBytes, createHash } from "node:crypto"
import nodemailer from "nodemailer"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { emailLayout, heading, paragraph, button, signoff } from "@/lib/email/template"
import { getPrisma } from "@/lib/prisma"
import { withObservedRoute } from "@/lib/observability/with-observed-route"

const TOKEN_TTL_MINUTES = 30

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

const POSTHandler = async () => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  if (!user?.email) {
    return NextResponse.json(
      { error: "K účtu nie je priradený e-mail." },
      { status: 400 }
    )
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM ?? "Print Expert <info@printexpert.sk>"

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return NextResponse.json({ error: "SMTP nie je nastavené." }, { status: 500 })
  }

  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

  await prisma.authToken.deleteMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
  })

  const createdToken = await prisma.authToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"
  const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const subject = "Obnovenie hesla"
  const text = `Dobrý deň${user.name ? ` ${user.name}` : ""},\n\nkliknite na odkaz pre obnovenie hesla:\n${resetUrl}\n\nOdkaz je platný ${TOKEN_TTL_MINUTES} minút.\n\nAk ste o zmenu hesla nežiadali, e-mail ignorujte.`
  const html = emailLayout(
    [
      heading("Obnovenie hesla"),
      paragraph(
        `Dobrý deň${user.name ? ` ${user.name}` : ""}, dostali sme žiadosť o obnovenie hesla k vášmu účtu.`
      ),
      paragraph(`Odkaz je platný ${TOKEN_TTL_MINUTES} minút.`),
      button("Nastaviť nové heslo", resetUrl),
      paragraph("Ak ste o zmenu hesla nežiadali, tento e-mail môžete ignorovať."),
      signoff(),
    ].join(""),
    "Obnovenie hesla"
  )

  try {
    await transport.sendMail({
      from: smtpFrom,
      to: user.email,
      subject,
      text,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    await prisma.authToken.deleteMany({
      where: {
        id: createdToken.id,
        usedAt: null,
      },
    })
    return NextResponse.json(
      { error: "Nepodarilo sa odoslať e-mail na obnovenie hesla." },
      { status: 500 }
    )
  }
}

export const POST = withObservedRoute(
  "POST /api/account/password-reset/request",
  POSTHandler
)
