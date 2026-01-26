"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

export function HeaderSearch() {
  const router = useRouter()

  return (
    <div className="relative hidden w-full max-w-sm lg:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Hľadať produkty..."
        className="h-9 w-full min-w-[300px] rounded-full bg-secondary/50 pl-9 border-border/50 focus-visible:ring-primary/20 transition-all hover:bg-secondary/80 focus:bg-background"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            router.push(`/catalog?q=${(e.currentTarget as HTMLInputElement).value}`)
          }
        }}
      />
    </div>
  )
}
