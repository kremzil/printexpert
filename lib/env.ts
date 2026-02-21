import { z } from "zod"

/**
 * Server-side environment variables schema.
 * Validated once at startup via `instrumentation.ts`.
 *
 * Variables that are only needed at runtime (SMTP, Stripe, DPD, S3)
 * are marked optional so `next build` can succeed without them.
 * Critical boot-time vars (DATABASE_URL, auth) are required.
 */

const serverSchema = z.object({
  // ── Database (required for boot) ──
  DATABASE_URL: z
    .string({ message: "DATABASE_URL je povinný" })
    .url("DATABASE_URL musí byť platné URL"),

  // ── Auth (required for boot) ──
  // NextAuth v5 uses AUTH_SECRET (not NEXTAUTH_SECRET)
  AUTH_SECRET: z
    .string({ message: "AUTH_SECRET je povinný" })
    .min(16, "AUTH_SECRET musí mať aspoň 16 znakov"),

  // ── SMTP (optional at build, needed at runtime for emails) ──
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_TO: z.string().email().optional(),

  // ── Stripe (optional at build) ──
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── S3 (optional at build) ──
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),

  // ── Uploads ──
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().optional(),

  // ── DPD ──
  DPD_API_BASE_URL: z.string().url().optional(),

  // ── Observability ──
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .optional()
    .default("info"),
  LOG_PRETTY: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
  OBS_SERVICE_NAME: z.string().optional(),
  OBS_ENV: z.string().optional(),
  LOG_IP_HASH_SALT: z.string().optional(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string({ message: "NEXT_PUBLIC_SITE_URL je povinný" })
    .url("NEXT_PUBLIC_SITE_URL musí byť platné URL"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_MODE: z.enum(["test", "live"]).optional(),
  NEXT_PUBLIC_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>

/**
 * Validate server env vars. Call once from `instrumentation.ts`.
 * Throws with a descriptive message listing all validation errors.
 */
export function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(
      `\n❌ Neplatná konfigurácia serverových premenných prostredia:\n${issues}\n`
    )
  }
  return result.data
}

/**
 * Validate client (NEXT_PUBLIC_*) env vars.
 */
export function validateClientEnv(): ClientEnv {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_MODE: process.env.NEXT_PUBLIC_STRIPE_MODE,
    NEXT_PUBLIC_UPLOAD_MAX_BYTES: process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES,
  })
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(
      `\n❌ Neplatná konfigurácia klientskych premenných prostredia:\n${issues}\n`
    )
  }
  return result.data
}
