import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import Nodemailer from "next-auth/providers/nodemailer"
import Google from "next-auth/providers/google"
import { z } from "zod"

import { authConfig } from "./auth.config"
import { getPrisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/auth"
import { UserRole } from "@/lib/generated/prisma"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { getClientIpHash, hashValue } from "@/lib/request-utils"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const hashEmail = (email: string) => hashValue(email.trim().toLowerCase())

// Расширяем PrismaAdapter для поддержки кастомного поля role
function customPrismaAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(getPrisma())
  return {
    ...baseAdapter,
    createUser: async (data) => {
      const prisma = getPrisma()
      const user = await prisma.user.create({
        data: {
          ...data,
          role: UserRole.USER, // Устанавливаем роль по умолчанию
        },
      })
      return user
    },
  } as Adapter
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: customPrismaAdapter() as Adapter,
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    // Magic Links через Nodemailer (SMTP)
    Nodemailer({
      from: process.env.SMTP_FROM ?? "Print Expert <info@printexpert.sk>",
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
    }),
    
    // Пароли через Credentials Provider
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const ipHash = getClientIpHash(request)
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) {
          logger.warn({
            event: OBS_EVENT.AUTH_LOGIN_FAILED,
            provider: "credentials",
            reason: "validation_failed",
            ipHash,
          })
          return null
        }
        const normalizedEmail = parsed.data.email.toLowerCase()
        const emailHash = hashEmail(normalizedEmail)
        logger.info({
          event: OBS_EVENT.AUTH_LOGIN_ATTEMPT,
          provider: "credentials",
          ipHash,
          emailHash,
        })

        const prisma = getPrisma()
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        if (!user?.passwordHash) {
          logger.warn({
            event: OBS_EVENT.AUTH_LOGIN_FAILED,
            provider: "credentials",
            reason: "user_not_found_or_no_password",
            ipHash,
            emailHash,
          })
          return null
        }

        const isValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        )

        if (!isValid) {
          logger.warn({
            event: OBS_EVENT.AUTH_LOGIN_FAILED,
            provider: "credentials",
            reason: "invalid_password",
            ipHash,
            emailHash,
            userId: user.id,
          })
          return null
        }

        logger.info({
          event: OBS_EVENT.AUTH_LOGIN_SUCCESS,
          provider: "credentials",
          ipHash,
          emailHash,
          userId: user.id,
          role: user.role,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Обновляем роль из БД только если её нет в токене
      if (token.id && !user && typeof token.role === "undefined") {
        const prisma = getPrisma()
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        })
        if (currentUser) {
          token.role = currentUser.role
        }
      }
      
      if (trigger === "update" && session) {
        token = { ...token, ...session }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
})
