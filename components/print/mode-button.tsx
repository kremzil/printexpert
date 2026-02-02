"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Slot } from "@radix-ui/react-slot"

import type { CustomerMode } from "@/components/print/types"

interface ModeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  mode?: CustomerMode
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "xs" | "sm" | "md" | "lg" | "icon"
  asChild?: boolean
  children: ReactNode
}

export function ModeButton({
  mode = "b2c",
  variant = "primary",
  size = "md",
  asChild = false,
  children,
  className = "",
  ...props
}: ModeButtonProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const sizeClasses = {
    xs: "px-2.5 py-1 text-xs",
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
    icon: "h-9 w-9 p-0",
  }

  const baseClasses = `
    inline-flex items-center justify-center gap-2 rounded-lg font-medium
    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
  `

  const Component = asChild ? Slot : "button"

  if (variant === "primary") {
    return (
      <Component
        className={`${baseClasses} text-white shadow-sm hover:shadow-md active:scale-[0.98] ${className}`}
        style={{ backgroundColor: modeColor }}
        {...props}
      >
        {children}
      </Component>
    )
  }

  if (variant === "secondary") {
    return (
      <Component
        className={`${baseClasses} shadow-sm hover:shadow active:scale-[0.98] ${className}`}
        style={{ backgroundColor: modeAccent, color: modeColor }}
        {...props}
      >
        {children}
      </Component>
    )
  }

  if (variant === "outline") {
    return (
      <Component
        className={`${baseClasses} border-2 bg-white hover:shadow-sm active:scale-[0.98] ${className}`}
        style={{ borderColor: modeColor, color: modeColor }}
        {...props}
      >
        {children}
      </Component>
    )
  }

  return (
    <Component
      className={`${baseClasses} bg-transparent hover:bg-muted active:scale-[0.98] ${className}`}
      style={{ color: modeColor }}
      {...props}
    >
      {children}
    </Component>
  )
}
