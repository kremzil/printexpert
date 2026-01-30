import { Card } from "@/components/ui/card"
import type { CustomerMode } from "@/components/print/types"
import type { LucideIcon } from "lucide-react"

type ContactInfoItem = {
  icon: LucideIcon
  label: string
  value: string | string[]
  href?: string
  mode?: "b2c" | "b2b" | "both"
}

interface ContactInfoProps {
  mode: CustomerMode
  items: ContactInfoItem[]
}

export function ContactInfo({ mode, items }: ContactInfoProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const filteredItems = items.filter(
    (item) => !item.mode || item.mode === mode || item.mode === "both"
  )

  return (
    <div className="space-y-4">
      {filteredItems.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="p-6">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: modeAccent }}
              >
                <Icon className="h-6 w-6" style={{ color: modeColor }} />
              </div>
              <div className="flex-1">
                <div className="mb-1 text-sm font-medium text-muted-foreground">
                  {item.label}
                </div>
                {Array.isArray(item.value) ? (
                  <div className="space-y-1 font-semibold">
                    {item.value.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                ) : item.href ? (
                  <a
                    href={item.href}
                    className="font-semibold hover:underline"
                    style={{ color: modeColor }}
                  >
                    {item.value}
                  </a>
                ) : (
                  <div className="font-semibold">{item.value}</div>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
