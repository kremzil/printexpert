"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"

import { Input } from "@/components/ui/input"

type SearchProduct = {
  id: string
  slug: string
  name: string
  priceFrom?: string | null
  images?: Array<{ url: string; alt?: string | null }>
}

type SearchCategory = {
  id: string
  slug: string
  name: string
}

type SearchResponse = {
  query: string
  products: SearchProduct[]
  categories: SearchCategory[]
  total: number
}

const MIN_QUERY_LENGTH = 2
const PRODUCT_LIMIT = 6
const CATEGORY_LIMIT = 4

export function HeaderSearch() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const trimmedQuery = query.trim()
  const showPanel = isFocused && (trimmedQuery.length > 0 || isLoading)

  const formatPrice = (value?: string | null) => {
    if (!value) return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(parsed)
  }

  const hasResults = useMemo(() => {
    if (!results) return false
    return results.products.length > 0 || results.categories.length > 0
  }, [results])

  const handleSubmit = (value: string) => {
    const nextValue = value.trim()
    if (!nextValue) return
    router.push(`/catalog?q=${encodeURIComponent(nextValue)}`)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!showPanel) {
      setIsOpen(false)
      return
    }
    setIsOpen(true)
  }, [showPanel])

  useEffect(() => {
    if (!trimmedQuery || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${PRODUCT_LIMIT}&categoryLimit=${CATEGORY_LIMIT}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          setResults(null)
          setIsLoading(false)
          return
        }
        const data = (await response.json()) as SearchResponse
        setResults(data)
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults(null)
        }
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [trimmedQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm lg:block">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit(query)
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          placeholder="Hľadať produkty alebo kategórie..."
          className="h-9 w-full min-w-[300px] rounded-full bg-secondary/50 pl-9 border-border/50 focus-visible:ring-primary/20 transition-all hover:bg-secondary/80 focus:bg-background"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false)
            }
          }}
        />
      </form>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="p-3">
            {trimmedQuery.length < MIN_QUERY_LENGTH ? (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Zadajte aspoň {MIN_QUERY_LENGTH} znaky na vyhľadávanie.
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítavam návrhy…
              </div>
            ) : hasResults ? (
              <div className="space-y-4">
                {results?.products.length ? (
                  <div className="space-y-2">
                    <div className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                      Produkty
                    </div>
                    <div className="space-y-1">
                      {results.products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            router.push(`/product/${product.slug}`)
                            setIsOpen(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted"
                        >
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-muted/40">
                            {product.images?.[0]?.url ? (
                              <Image
                                src={product.images[0].url}
                                alt={product.images[0].alt || product.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              {product.name}
                            </div>
                            {formatPrice(product.priceFrom) ? (
                              <div className="text-xs text-muted-foreground">
                                Od {formatPrice(product.priceFrom)}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {results?.categories.length ? (
                  <div className="space-y-2">
                    <div className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                      Kategórie
                    </div>
                    <div className="space-y-1">
                      {results.categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            router.push(`/catalog?cat=${category.slug}`)
                            setIsOpen(false)
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted"
                        >
                          <span className="font-medium">{category.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Zobraziť
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleSubmit(query)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted/70"
                >
                  <span>Zobraziť všetky výsledky</span>
                  <span className="text-xs text-muted-foreground">
                    {results?.total ?? 0}
                  </span>
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Nenašli sa žiadne výsledky.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
