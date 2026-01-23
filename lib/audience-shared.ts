export type Audience = "b2b" | "b2c"
export type AudienceSource = "query" | "cookie" | "account" | "default"

export type AudienceContext = {
  audience: Audience
  source: AudienceSource
  expiresAt?: string
  locale?: string
  country?: string
}

export const AUDIENCE_QUERY_PARAM = "mode"
export const AUDIENCE_COOKIE_NAME = "audience"
export const AUDIENCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const parseAudience = (
  value: string | null | undefined
): Audience | null => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "b2b" || normalized === "b2c") {
    return normalized
  }
  return null
}
