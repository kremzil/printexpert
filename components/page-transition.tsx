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
  const [isVisible, setIsVisible] = useState(true)
  const transitionKey = `${pathname}?mode=${modeParam}`
  const prevTransitionKey = useRef(transitionKey)

  useEffect(() => {
    if (transitionKey !== prevTransitionKey.current) {
      prevTransitionKey.current = transitionKey
      setIsVisible(false)
      // Force a micro-task so the opacity-0 frame renders first
      const id = requestAnimationFrame(() => {
        setIsVisible(true)
        window.scrollTo({ top: 0, left: 0, behavior: "auto" })
      })
      return () => cancelAnimationFrame(id)
    }
  }, [transitionKey])

  return (
    <div
      className={`page-transition ${isVisible ? "page-transition-enter" : "page-transition-exit"}`}
    >
      {children}
    </div>
  )
}
