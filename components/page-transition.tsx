"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

type PageTransitionProps = {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get("mode") ?? ""
  const [isVisible, setIsVisible] = useState<boolean | null>(true)
  const transitionKey = `${pathname}?mode=${modeParam}`
  const prevTransitionKey = useRef(transitionKey)

  useEffect(() => {
    if (transitionKey !== prevTransitionKey.current) {
      prevTransitionKey.current = transitionKey
      // Double-rAF ensures the browser paints opacity:0 before starting fade-in
      let cancelled = false
      requestAnimationFrame(() => {
        if (cancelled) return
        setIsVisible(false)
        requestAnimationFrame(() => {
          if (cancelled) return
          setIsVisible(true)
          window.scrollTo({ top: 0, left: 0, behavior: "auto" })
        })
      })
      return () => { cancelled = true }
    }
  }, [transitionKey])

  return (
    <div
      className={`page-transition ${
        isVisible === null
          ? ""
          : isVisible
            ? "page-transition-enter"
            : "page-transition-exit"
      }`}
    >
      {children}
    </div>
  )
}
