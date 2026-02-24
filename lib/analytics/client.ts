"use client"

import { COOKIE_CONSENT_KEY, type CookieConsentStatus } from "@/lib/analytics/constants"

type DataLayerPayload = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    __peGtmLoaded?: boolean
  }
}

const isBrowser = () => typeof window !== "undefined"

export const isMarketingConsentAccepted = () => {
  if (!isBrowser()) return false
  return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted"
}

export const pushToDataLayer = (payload: DataLayerPayload) => {
  if (!isBrowser()) return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(payload)
}

export const pushConsentDataLayerEvent = (status: CookieConsentStatus) => {
  pushToDataLayer({
    event: status === "accepted" ? "consent_granted" : "consent_denied",
    consent_state: status,
  })
}

export const trackDataLayerEvent = (
  eventName: string,
  payload: DataLayerPayload = {}
) => {
  if (!isBrowser()) return false

  pushToDataLayer({
    event: eventName,
    ...payload,
  })
  return true
}
