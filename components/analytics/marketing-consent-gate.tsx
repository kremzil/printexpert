"use client"

import { useEffect } from "react"

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_KEY,
  type CookieConsentStatus,
} from "@/lib/analytics/constants"
import { pushConsentDataLayerEvent, pushToDataLayer } from "@/lib/analytics/client"

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID

const isValidConsentStatus = (value: string | null): value is CookieConsentStatus =>
  value === "accepted" || value === "declined"

const loadGtmScript = () => {
  if (typeof window === "undefined") return
  if (!GTM_ID) return
  if (window.__peGtmLoaded) return

  window.dataLayer = window.dataLayer ?? []
  pushToDataLayer({
    "gtm.start": Date.now(),
    event: "gtm.js",
  })
  if (GA4_ID) {
    pushToDataLayer({
      event: "ga4_measurement_id",
      measurement_id: GA4_ID,
    })
  }

  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
  document.head.appendChild(script)
  window.__peGtmLoaded = true
}

export function MarketingConsentGate() {
  useEffect(() => {
    if (typeof window === "undefined") return

    loadGtmScript()

    const initialStatusRaw = window.localStorage.getItem(COOKIE_CONSENT_KEY)
    if (isValidConsentStatus(initialStatusRaw)) {
      pushConsentDataLayerEvent(initialStatusRaw)
    }

    const onConsentChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ status?: CookieConsentStatus }>
      const status = customEvent.detail?.status
      if (!status) return
      loadGtmScript()
    }

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged as EventListener)
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_CHANGED_EVENT,
        onConsentChanged as EventListener
      )
    }
  }, [])

  return null
}
