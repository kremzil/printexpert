"use client"

import { useEffect, useState, useRef, useCallback, type ReactNode } from "react"
import { usePathname } from "next/navigation"

type SiteHeaderClientProps = {
  topBar: ReactNode
  navBar: ReactNode
  centerBar?: ReactNode
  showNav?: boolean
}

export function SiteHeaderClient({
  topBar,
  navBar,
  centerBar,
  showNav = true,
}: SiteHeaderClientProps) {
  const pathname = usePathname()
  const [hideNav, setHideNav] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  
  const lastScrollYRef = useRef(0)
  const ticking = useRef(false)

  const updateHeader = useCallback(() => {
    const currentScrollY = window.scrollY
    const lastScrollY = lastScrollYRef.current

    // At top of page
    if (currentScrollY < 10) {
      setHideNav(false)
      setIsAtTop(true)
      lastScrollYRef.current = currentScrollY
      ticking.current = false
      return
    }

    setIsAtTop(false)

    // Calculate scroll direction with threshold
    const scrollDelta = currentScrollY - lastScrollY
    
    if (Math.abs(scrollDelta) > 5) {
      // Scrolling down - hide nav bar
      if (scrollDelta > 0 && currentScrollY > 60) {
        setHideNav(true)
      }
      // Scrolling up - show nav bar
      else if (scrollDelta < 0) {
        setHideNav(false)
      }
      lastScrollYRef.current = currentScrollY
    }

    ticking.current = false
  }, [])

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return
    }

    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(updateHeader)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [pathname, updateHeader])

  if (pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <>
      {/* Top bar - always visible */}
      <div 
        className={`
          sticky top-0 z-50
          bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60
          border-b border-border/30
          transition-shadow duration-300 ease-out
          ${isAtTop ? 'shadow-none' : 'shadow-sm'}
        `}
      >
        <div className="mx-auto w-full max-w-480 lg:px-8">
          <div className="relative flex h-16 items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
            {centerBar ? (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {centerBar}
              </div>
            ) : null}
            {topBar}
          </div>
        </div>
      </div>

      {/* Nav bar - fades out completely */}
      {showNav ? (
        <div 
          className={`
            sticky top-16 z-40
            hidden lg:block
            bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60
            border-b border-border/30 shadow-sm
            transition-opacity duration-200 ease-out
            ${hideNav ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          `}
          aria-hidden={hideNav}
        >
          <div className="mx-auto w-full max-w-480 lg:px-8">
            <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6 md:px-8">
              {navBar}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
