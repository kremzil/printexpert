"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { CustomerMode } from "@/components/print/types"

type FaqItem = {
  question: string
  answer: string
  mode?: "b2c" | "b2b" | "both"
}

interface FAQSectionProps {
  mode: CustomerMode
  items: FaqItem[]
}

export function FAQSection({ mode, items }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const filteredItems = items.filter(
    (item) => !item.mode || item.mode === mode || item.mode === "both"
  )

  return (
    <div className="space-y-3">
      {filteredItems.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <Card key={item.question} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-muted/30"
            >
              <span className="pr-4 font-semibold">{item.question}</span>
              {isOpen ? (
                <ChevronUp
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: modeColor }}
                />
              ) : (
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              )}
            </button>
            {isOpen ? (
              <div
                className="border-t border-border px-6 py-4 text-muted-foreground"
                style={{ backgroundColor: modeAccent }}
              >
                {item.answer}
              </div>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}
