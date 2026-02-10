import { useSyncExternalStore } from "react"

import type { CustomerMode } from "@/components/print/types"

type Listener = () => void

let current: CustomerMode | null = null
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
}

export function showModeOverlay(mode: CustomerMode) {
  current = mode
  emit()
}

export function clearModeOverlay() {
  current = null
  emit()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return current
}

function getServerSnapshot() {
  return null
}

export function useModeOverlayStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
