import "server-only"

import { cookies } from "next/headers"

import {
  AUDIENCE_COOKIE_NAME,
  AUDIENCE_QUERY_PARAM,
  type Audience,
  type AudienceContext,
  parseAudience,
} from "@/lib/audience-shared"

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams

type ResolveAudienceOptions = {
  request?: Request
  searchParams?: SearchParamsInput
}

const getSearchParamValue = (
  searchParams: SearchParamsInput | undefined,
  key: string
) => {
  if (!searchParams) return undefined
  if (searchParams instanceof URLSearchParams) {
    const value = searchParams.get(key)
    return value ?? undefined
  }
  const value = searchParams[key]
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

const getCookieValue = (cookieHeader: string, name: string) => {
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=")
    if (!rawKey) continue
    const key = rawKey.trim()
    if (key !== name) continue
    return rest.join("=").trim()
  }
  return undefined
}

const getAudienceFromRequestCookies = (request?: Request): Audience | null => {
  if (!request) return null
  const cookieHeader = request.headers.get("cookie") ?? ""
  if (!cookieHeader) return null
  return parseAudience(getCookieValue(cookieHeader, AUDIENCE_COOKIE_NAME))
}

const getAudienceFromServerCookies = async (): Promise<Audience | null> => {
  const store = await cookies()
  const value = store.get(AUDIENCE_COOKIE_NAME)?.value
  return parseAudience(value)
}

const resolveAccountAudience = async (): Promise<Audience | null> => {
  return null
}

export const resolveAudienceContext = async (
  options: ResolveAudienceOptions = {}
): Promise<AudienceContext> => {
  const queryFromSearchParams = getSearchParamValue(
    options.searchParams,
    AUDIENCE_QUERY_PARAM
  )
  const queryFromRequest = options.request?.url
    ? (() => {
        try {
          return new URL(options.request?.url).searchParams.get(
            AUDIENCE_QUERY_PARAM
          )
        } catch {
          return null
        }
      })()
    : null
  const queryAudience = parseAudience(queryFromSearchParams ?? queryFromRequest)

  if (queryAudience) {
    return {
      audience: queryAudience,
      source: "query",
    }
  }

  const accountAudience = await resolveAccountAudience()
  if (accountAudience) {
    return {
      audience: accountAudience,
      source: "account",
    }
  }

  const cookieAudience = options.request
    ? getAudienceFromRequestCookies(options.request)
    : await getAudienceFromServerCookies()
  if (cookieAudience) {
    return {
      audience: cookieAudience,
      source: "cookie",
    }
  }

  return {
    audience: "b2c",
    source: "default",
  }
}
