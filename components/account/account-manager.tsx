"use client"

import { Card } from "@/components/ui/card"
import { Mail, Phone, CheckCircle } from "lucide-react"

interface AccountManagerProps {
  mode: "b2c" | "b2b"
  manager?: {
    name: string
    position: string
    email: string
    phone: string
    avatar?: string
  }
}

export function AccountManager({ mode, manager }: AccountManagerProps) {
  if (mode !== "b2b" || !manager) return null

  const modeColor = "var(--b2b-primary)"
  const benefits = [
    "Chránená zóna od 10%",
    "Osobný account manažér",
    "Platba na faktúru, 14 dní",
    "Prioritná výroba",
    "Dashboards ošetrí",
  ]

  return (
    <div className="space-y-6">
      {/* Account Manager */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Váš account manažér</h3>
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: modeColor }}
          >
            {manager.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{manager.name}</div>
            <div className="text-sm text-muted-foreground">{manager.position}</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${manager.email}`} className="hover:underline">
                  {manager.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${manager.phone}`} className="hover:underline">
                  {manager.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* B2B Benefits */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">B2B výhody</h3>
        <ul className="space-y-3">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
              <span className="text-sm">{benefit}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
