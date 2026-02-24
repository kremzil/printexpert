"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_KEY,
  type CookieConsentStatus,
} from "@/lib/analytics/constants"
import { pushConsentDataLayerEvent } from "@/lib/analytics/client"

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Delay appearance for smoother page load experience
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
    if (consent === "accepted" || consent === "declined") {
      pushConsentDataLayerEvent(consent)
    }
  }, [])

  const applyConsent = (status: CookieConsentStatus) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, status)
    pushConsentDataLayerEvent(status)
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, {
        detail: { status },
      })
    )
    setVisible(false)
  }

  const accept = () => {
    applyConsent("accepted")
  }

  const decline = () => {
    applyConsent("declined")
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Súhlas s cookies"
      className="fixed bottom-0 left-0 right-0 z-9998 animate-in slide-in-from-bottom-4 fade-in duration-500"
    >
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border border-border/60 bg-background/95 px-5 py-4 shadow-lg backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-foreground/80">
              Táto stránka používa súbory cookies na zabezpečenie funkčnosti
              a&nbsp;zlepšenie používateľského zážitku.{" "}
              <Link
                href="/ochrana-osobnych-udajov"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Viac informácií
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={decline}
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Odmietnuť
              </button>
              <button
                type="button"
                onClick={accept}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Súhlasím
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
