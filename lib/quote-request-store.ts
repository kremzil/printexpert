export type QuoteRequestItem = {
  slug: string
  name: string
  imageUrl: string
  imageAlt: string
  addedAt: string
  configuration?: {
    quantity?: number
    dimensions?: string | null
    options?: Array<{ label: string; value: string }>
    totalPrice?: number | null
  }
}

export type QuoteRequestContact = {
  name: string
  email: string
  phone: string
  company: string
  note: string
}

type QuoteRequestState = {
  version: number
  items: QuoteRequestItem[]
  savedAt: number
}

const QUOTE_REQUEST_CACHE_KEY = "printexpert_quote_request_v1"
const QUOTE_REQUEST_CONTACT_KEY = "printexpert_quote_contact_v1"
const QUOTE_REQUEST_CACHE_VERSION = 1
const QUOTE_REQUEST_MAX_ITEMS = 30
const QUOTE_REQUEST_UPDATED_EVENT = "quote-request-updated"

const getWindow = () => (typeof window === "undefined" ? null : window)

const readRawCache = (): QuoteRequestState | null => {
  const currentWindow = getWindow()
  if (!currentWindow) return null

  try {
    const raw = currentWindow.localStorage.getItem(QUOTE_REQUEST_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as QuoteRequestState
    if (
      !parsed ||
      parsed.version !== QUOTE_REQUEST_CACHE_VERSION ||
      !Array.isArray(parsed.items)
    ) {
      currentWindow.localStorage.removeItem(QUOTE_REQUEST_CACHE_KEY)
      return null
    }

    return parsed
  } catch {
    try {
      currentWindow.localStorage.removeItem(QUOTE_REQUEST_CACHE_KEY)
    } catch {
      // ignore
    }
    return null
  }
}

const writeRawCache = (items: QuoteRequestItem[]) => {
  const currentWindow = getWindow()
  if (!currentWindow) return

  try {
    currentWindow.localStorage.setItem(
      QUOTE_REQUEST_CACHE_KEY,
      JSON.stringify({
        version: QUOTE_REQUEST_CACHE_VERSION,
        items: items.slice(0, QUOTE_REQUEST_MAX_ITEMS),
        savedAt: Date.now(),
      } satisfies QuoteRequestState)
    )
  } catch {
    // ignore storage write errors
  }
}

export const readQuoteRequestItems = (): QuoteRequestItem[] => {
  return readRawCache()?.items ?? []
}

export const isQuoteRequestItem = (slug: string): boolean => {
  return readQuoteRequestItems().some((item) => item.slug === slug)
}

export const upsertQuoteRequestItem = (item: QuoteRequestItem): QuoteRequestItem[] => {
  const currentItems = readQuoteRequestItems()
  const existingIndex = currentItems.findIndex((entry) => entry.slug === item.slug)

  if (existingIndex >= 0) {
    const updated = [...currentItems]
    updated[existingIndex] = {
      ...updated[existingIndex],
      name: item.name,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
      addedAt: item.addedAt,
      configuration: item.configuration ?? updated[existingIndex].configuration,
    }
    writeRawCache(updated)
    return updated
  }

  const nextItems = [item, ...currentItems].slice(0, QUOTE_REQUEST_MAX_ITEMS)
  writeRawCache(nextItems)
  return nextItems
}

export const removeQuoteRequestItem = (slug: string): QuoteRequestItem[] => {
  const nextItems = readQuoteRequestItems().filter((item) => item.slug !== slug)
  writeRawCache(nextItems)
  return nextItems
}

export const clearQuoteRequestItems = (): void => {
  const currentWindow = getWindow()
  if (!currentWindow) return

  try {
    currentWindow.localStorage.removeItem(QUOTE_REQUEST_CACHE_KEY)
  } catch {
    // ignore
  }
}

export const readQuoteRequestContact = (): QuoteRequestContact | null => {
  const currentWindow = getWindow()
  if (!currentWindow) return null

  try {
    const raw = currentWindow.localStorage.getItem(QUOTE_REQUEST_CONTACT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuoteRequestContact
    if (!parsed || typeof parsed !== "object") return null

    return {
      name: String(parsed.name ?? ""),
      email: String(parsed.email ?? ""),
      phone: String(parsed.phone ?? ""),
      company: String(parsed.company ?? ""),
      note: String(parsed.note ?? ""),
    }
  } catch {
    try {
      currentWindow.localStorage.removeItem(QUOTE_REQUEST_CONTACT_KEY)
    } catch {
      // ignore
    }
    return null
  }
}

export const writeQuoteRequestContact = (contact: QuoteRequestContact): void => {
  const currentWindow = getWindow()
  if (!currentWindow) return

  try {
    currentWindow.localStorage.setItem(
      QUOTE_REQUEST_CONTACT_KEY,
      JSON.stringify(contact)
    )
  } catch {
    // ignore
  }
}

export {
  QUOTE_REQUEST_CACHE_KEY,
  QUOTE_REQUEST_CONTACT_KEY,
  QUOTE_REQUEST_CACHE_VERSION,
  QUOTE_REQUEST_UPDATED_EVENT,
  QUOTE_REQUEST_MAX_ITEMS,
}
