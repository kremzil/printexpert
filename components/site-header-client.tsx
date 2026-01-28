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
  
  // Use ref instead of state for scroll position to avoid re-triggering effect loop
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    // Skip scroll listener on admin pages
    if (pathname?.startsWith("/admin")) {
      return
    }

    const handleScroll = () => {
      const currentScrollY = Math.max(0, window.scrollY)
      const lastScrollY = lastScrollYRef.current
      const threshold = 10
      
      // Логотип уменьшается при скролле > 50px
      const shouldBeScrolled = currentScrollY > 50
      
      // Обновляем стейт только если изменился, чтобы не ререндерить лишний раз
      setIsScrolled((prev) => {
        if (prev !== shouldBeScrolled) return shouldBeScrolled
        return prev
      })
      
      if (currentScrollY < 80) {
        setIsScrollingDown(false)
        // ВАЖНО: Обновляем ref, чтобы при выходе из этой зоны мы сравнивали с актуальной позицией,
        // а не с той, которая была до входа в зону < 80.
        lastScrollYRef.current = currentScrollY
      } else if (Math.abs(currentScrollY - lastScrollY) > threshold) {
        // Меняем состояние только при преодолении порога
        setIsScrollingDown(currentScrollY > lastScrollY)
        // Обновляем реф только когда значительно сдвинулись, чтобы гистерезис работал
        lastScrollYRef.current = currentScrollY 
      }
    }

    // Дебаунс/троттлинг через requestAnimationFrame не обязателен для modern browsers с passive: true,
    // но если оставить, то аккуратно. В данном случае упростим до прямого вызова 
    // с проверкой внутри, так надежнее для React state updates.
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname]) // Re-evaluate when the route changes

  // Don't render header on admin pages
  if (pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur shadow-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[1600px] flex-col">
        <div 
          className={`flex items-center justify-between gap-4 px-4 transition-all duration-300 ${
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
          <div className="flex h-14 items-center px-4">
            {navBar}
          </div>
        </div>
      </div>
    </header>
  )
}
