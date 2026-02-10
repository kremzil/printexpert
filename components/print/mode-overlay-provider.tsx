"use client"

import { useCallback } from "react"

import { ModeTransitionOverlay } from "@/components/print/mode-transition-overlay"
import { clearModeOverlay, useModeOverlayStore } from "@/lib/mode-overlay-store"

/**
 * Standalone client component — renders the overlay when active.
 * Does NOT wrap children, so it won't shift the server component tree.
 */
export function ModeOverlayPortal() {
  const activeMode = useModeOverlayStore()

  const handleDone = useCallback(() => {
    clearModeOverlay()
  }, [])

  if (!activeMode) return null

  return <ModeTransitionOverlay mode={activeMode} onDone={handleDone} />
}
