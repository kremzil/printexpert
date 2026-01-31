import { Check } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

type CheckoutStep = {
  number: number
  title: string
  description: string
}

interface CheckoutStepsProps {
  mode: CustomerMode
  currentStep: number
  steps: CheckoutStep[]
}

export function CheckoutSteps({ mode, currentStep, steps }: CheckoutStepsProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isCompleted = step.number < currentStep
          const isLast = index === steps.length - 1

          return (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                    isCompleted
                      ? "text-white"
                      : isActive
                      ? "border-2 text-white"
                      : "border-2 border-border bg-background text-muted-foreground"
                  }`}
                  style={{
                    backgroundColor: isCompleted || isActive ? modeColor : undefined,
                    borderColor: isActive ? modeColor : undefined,
                  }}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : step.number}
                </div>

                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-semibold ${
                      isActive || isCompleted ? "" : "text-muted-foreground"
                    }`}
                    style={{ color: isActive || isCompleted ? modeColor : undefined }}
                  >
                    {step.title}
                  </div>
                  <div className="hidden text-xs text-muted-foreground md:block">
                    {step.description}
                  </div>
                </div>
              </div>

              {!isLast && (
                <div className="mx-2 h-0.5 flex-1 bg-border">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: isCompleted ? "100%" : "0%",
                      backgroundColor: modeColor,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
