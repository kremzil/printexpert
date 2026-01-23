import "server-only"

import crypto from "crypto"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import { promisify } from "node:util"

import { getPrisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "session"
export const SESSION_TTL_DAYS = 30
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
export const MAGIC_LINK_TTL_MINUTES = 20

const scryptAsync = promisify(crypto.scrypt)

const toBase64Url = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex")

export const createRandomToken = (size = 32) =>
  toBase64Url(crypto.randomBytes(size))

export const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString("hex")}`
}

export const verifyPassword = async (password: string, storedHash: string) => {
  const [method, salt, hash] = storedHash.split("$")
  if (method !== "scrypt" || !salt || !hash) {
    return false
  }
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(hash, "hex")
  if (storedKey.length !== derivedKey.length) {
    return false
  }
  return crypto.timingSafeEqual(storedKey, derivedKey)
}

export const createSession = async (userId: string) => {
  const prisma = getPrisma()
  const rawToken = createRandomToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  await prisma.session.create({
    data: {
      userId,
      sessionToken: tokenHash,
      expiresAt,
    },
  })

  return { rawToken, expiresAt }
}

const getSessionByTokenHash = async (tokenHash: string) => {
  const prisma = getPrisma()
  return prisma.session.findFirst({
    where: {
      sessionToken: tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  })
}

export const getSessionFromCookies = async () => {
  const store = await cookies()
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null
  return getSessionByTokenHash(hashToken(rawToken))
}

export const getSessionFromRequest = async (request: NextRequest) => {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null
  return getSessionByTokenHash(hashToken(rawToken))
}

export const setSessionCookie = (
  response: NextResponse,
  rawToken: string
) => {
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    maxAge: SESSION_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
}

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
}
