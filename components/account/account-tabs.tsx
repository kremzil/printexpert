"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Package, MapPin, Settings } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

const tabs = [
  {
    title: "Prehľad",
    url: "/account",
    icon: User,
    badge: undefined,
  },
  {
    title: "Objednávky",
    url: "/account/orders",
    icon: Package,
    badge: "3",
  },
  {
    title: "Adresy",
    url: "/account/addresses",
    icon: MapPin,
    badge: undefined,
  },
  {
    title: "Nastavenia",
    url: "/account/settings",
    icon: Settings,
    badge: undefined,
  },
]

interface AccountTabsProps {
  mode: 'b2c' | 'b2b'
  variant?: 'horizontal' | 'vertical'
}

export function AccountTabs({ mode, variant = 'horizontal' }: AccountTabsProps) {
  const pathname = usePathname()
  
  const modeAccent = mode === 'b2c' ? 'var(--b2c-accent)' : 'var(--b2b-accent)'
  const modeColor = mode === 'b2c' ? 'var(--b2c-primary)' : 'var(--b2b-primary)'

  if (variant === 'vertical') {
    return (
      <nav className="flex flex-col gap-1" aria-label="Account navigation">
        {tabs.map((tab) => {
          const isActive = pathname === tab.url
          const Icon = tab.icon
          return (
            <Link
              key={tab.title}
              href={tab.url}
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left font-medium transition-all hover:bg-muted/50"
              style={{
                backgroundColor: isActive ? modeAccent : 'transparent',
                color: isActive ? modeColor : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span>{tab.title}</span>
              </div>
              {tab.badge && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: isActive ? modeColor : 'var(--muted)',
                    color: isActive ? 'white' : 'var(--muted-foreground)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="border-b">
      <ScrollArea className="w-full">
        <nav className="flex w-max gap-2 pb-3" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.url
            const Icon = tab.icon
            return (
              <Link
                key={tab.title}
                href={tab.url}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? modeAccent : 'transparent',
                  borderColor: isActive ? modeColor : 'var(--border)',
                  color: isActive ? modeColor : 'var(--muted-foreground)',
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.title}</span>
                {tab.badge && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: isActive ? modeColor : 'var(--muted)',
                      color: isActive ? 'white' : 'var(--muted-foreground)',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}