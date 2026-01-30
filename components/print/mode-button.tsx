"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"

import type { CustomerMode } from "@/components/print/types"

interface ModeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  mode: CustomerMode
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  children: ReactNode
}

export function ModeButton({
  mode,
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ModeButtonProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
  }

  const baseClasses = `
    inline-flex items-center justify-center gap-2 rounded-lg font-medium
    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
  `

  if (variant === "primary") {
    return (
      <button
        className={`${baseClasses} text-white shadow-sm hover:shadow-md active:scale-[0.98] ${className}`}
        style={{ backgroundColor: modeColor }}
        {...props}
      >
        {children}
      </button>
    )
  }

  if (variant === "secondary") {
    return (
      <button
        className={`${baseClasses} shadow-sm hover:shadow active:scale-[0.98] ${className}`}
        style={{ backgroundColor: modeAccent, color: modeColor }}
        {...props}
      >
        {children}
      </button>
    )
  }

  if (variant === "outline") {
    return (
      <button
        className={`${baseClasses} border-2 bg-white hover:shadow-sm active:scale-[0.98] ${className}`}
        style={{ borderColor: modeColor, color: modeColor }}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      className={`${baseClasses} bg-transparent hover:bg-muted active:scale-[0.98] ${className}`}
      style={{ color: modeColor }}
      {...props}
    >
      {children}
    </button>
  )
}
