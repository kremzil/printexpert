"use client"

import { useEffect, useState, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"

type SiteHeaderClientProps = {
  topBar: ReactNode
  navBar: ReactNode
}

export function SiteHeaderClient({ topBar, navBar }: SiteHeaderClientProps) {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    // Skip scroll listener on admin pages
    if (pathname?.startsWith("/admin")) {
      return
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const lastScrollY = lastScrollYRef.current
      
      // 1. Logo shrink state (top bar height)
      const shouldBeScrolled = currentScrollY > 50
      setIsScrolled(shouldBeScrolled)

      // 2. Nav bar visibility state (based on the provided Alpine.js example)
      // Always show nav when at the top of the page
      if (currentScrollY <= 0) {
        setIsScrollingDown(false)
        lastScrollYRef.current = 0
        return
      }

      // Only update visibility if scroll difference is more than a threshold (10px)
      // This prevents "jiggle" on minor scroll movements
      if (Math.abs(currentScrollY - lastScrollY) > 10) {
        // Hide if scrolling down, show if scrolling up
        setIsScrollingDown(currentScrollY > lastScrollY)
      }

      // 3. Update last scroll position
      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname]) 

  // Don't render header on admin pages
  if (pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur shadow-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-500 flex-col">
        <div 
          className={`flex items-center justify-between gap-4 px-12 transition-all duration-300 ${
            isScrolled ? 'h-16' : 'h-20'
          }`}
          data-scrolled={isScrolled}
        >
          {topBar}
        </div>
        <div 
          className={`hidden md:block border-t border-border/50 transition-all duration-200 ease-in-out ${
            isScrollingDown ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-14 opacity-100'
          }`}
        >
          <div className="flex h-14 justify-center items-center px-8">
            {navBar}
          </div>
        </div>
      </div>
    </header>
  )
}
