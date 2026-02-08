"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

type PageTransitionProps = {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setIsVisible(false)
      // Force a micro-task so the opacity-0 frame renders first
      const id = requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [pathname])

  return (
    <div
      className={`page-transition ${isVisible ? "page-transition-enter" : "page-transition-exit"}`}
    >
      {children}
    </div>
  )
}
