"use client"

import { useEffect, useState, type ReactNode } from "react"

type SiteHeaderClientProps = {
  topBar: ReactNode
  navBar: ReactNode
}

export function SiteHeaderClient({ topBar, navBar }: SiteHeaderClientProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          
          // Добавляем порог в 10px чтобы избежать дрожания
          const threshold = 10
          
          // Логотип уменьшается при скролле > 50px
          setIsScrolled(currentScrollY > 50)
          
          if (currentScrollY < 80) {
            // В самом верху всегда показываем навбар
            setIsScrollingDown(false)
          } else if (currentScrollY > lastScrollY + threshold) {
            // Скроллим вниз на значительное расстояние
            setIsScrollingDown(true)
          } else if (currentScrollY < lastScrollY - threshold) {
            // Скроллим вверх на значительное расстояние
            setIsScrollingDown(false)
          }
          
          setLastScrollY(currentScrollY)
          ticking = false
        })

        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur shadow-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col">
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
