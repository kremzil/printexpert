"use client"

import { useCallback } from "react"

export function useToast() {
  const toast = useCallback(
    ({
      title,
      description,
      variant,
    }: {
      title: string
      description?: string
      variant?: "default" | "destructive"
    }) => {
      // Простая реализация через alert (можно заменить на более продвинутую)
      if (variant === "destructive") {
        alert(`${title}${description ? "\n" + description : ""}`)
      } else {
        console.log(title, description)
        // Можно добавить нотификацию
      }
    },
    []
  )

  return { toast }
}
