"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { ModeButton as Button } from "@/components/print/mode-button"
import { ScrollArea } from "@/components/ui/scroll-area"

type Category = {
  id: string
  name: string
  slug: string
  parentId: string | null
}

type CatalogSidebarProps = {
  categories: Category[]
}

export function CatalogSidebar({ categories }: CatalogSidebarProps) {
  const searchParams = useSearchParams()
  const activeSlug = searchParams.get("cat")

  // Group by parent
  const rootCategories = categories.filter((c) => !c.parentId)
  const childrenMap = new Map<string, Category[]>()
  
  categories.forEach((c) => {
    if (c.parentId) {
      if (!childrenMap.has(c.parentId)) {
        childrenMap.set(c.parentId, [])
      }
      childrenMap.get(c.parentId)?.push(c)
    }
  })

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="px-3 py-2">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">
          Kategórie
        </h2>
        <div className="space-y-1">
          <Button
            asChild
            variant={!activeSlug ? "secondary" : "ghost"}
            className="w-full justify-start font-medium text-white"
          >
            <Link href="/catalog">Všetky produkty</Link>
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4">
          {rootCategories.map((root) => {
            const children = childrenMap.get(root.id) ?? []
            // Check if root or any child is active
            const isRootActive = activeSlug === root.slug
            const isChildActive = children.some(c => c.slug === activeSlug)

            return (
              <div key={root.id} className="block">
                 <Button
                    asChild
                    variant={isRootActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start font-medium",
                      (isRootActive || isChildActive) && "font-semibold"
                    )}
                  >
                    <Link href={`/kategorie/${root.slug}`}>
                      {root.name}
                    </Link>
                  </Button>
                
                {children.length > 0 && (
                  <div className="ml-4 mt-1 flex flex-col space-y-1 border-l pl-2">
                    {children.map((child) => {
                        const isSelected = activeSlug === child.slug
                        return (
                            <Button
                                key={child.id}
                                asChild
                                variant={isSelected ? "secondary" : "ghost"}
                                size="sm"
                                className="w-full justify-start h-8 font-normal"
                            >
                                <Link href={`/kategorie/${child.slug}`}>
                                {child.name}
                                </Link>
                            </Button>
                        )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
