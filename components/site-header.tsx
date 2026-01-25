import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"
import { AudienceModeSwitch } from "@/components/audience-mode-switch"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getPrisma } from "@/lib/prisma"

async function AudienceBadge() {
  const audienceContext = await resolveAudienceContext()
  const label =
    audienceContext.source === "default"
      ? "Vyberte režim"
      : audienceContext.audience === "b2b"
        ? "Pre firmy"
        : "Pre jednotlivcov"
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold text-muted-foreground sm:text-xs">
      {label}
    </span>
  )
}

async function AudienceHeaderSwitch() {
  const audienceContext = await resolveAudienceContext()
  return <AudienceModeSwitch initialAudience={audienceContext.audience} />
}

async function AudienceNavigation() {
  const audienceContext = await resolveAudienceContext()
  const prisma = getPrisma()
  const audienceFilter =
    audienceContext.audience === "b2b"
      ? { showInB2b: true }
      : audienceContext.audience === "b2c"
        ? { showInB2c: true }
        : {}
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      ...audienceFilter,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  })
  const productAudienceFilter =
    audienceContext.audience === "b2b"
      ? { showInB2b: true }
      : audienceContext.audience === "b2c"
        ? { showInB2c: true }
        : {}
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...productAudienceFilter,
      category: {
        isActive: true,
        ...audienceFilter,
      },
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      categoryId: true,
    },
  })
  const productsByCategoryId = products.reduce((map, product) => {
    const list = map.get(product.categoryId) ?? []
    list.push(product)
    map.set(product.categoryId, list)
    return map
  }, new Map<string, typeof products>())
  const childrenByParentId = categories.reduce((map, category) => {
    const key = category.parentId ?? "root"
    const list = map.get(key) ?? []
    list.push(category)
    map.set(key, list)
    return map
  }, new Map<string, typeof categories>())
  const rootCategories = childrenByParentId.get("root") ?? []

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href="/">Domov</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        {rootCategories.length === 0 ? (
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
              <Link href="/kategorie">Kategórie</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ) : (
          rootCategories.map((category) => {
            const children = childrenByParentId.get(category.id) ?? []
            const items = children.length > 0 ? children : [category]
            const productItems = items.flatMap((item) =>
              productsByCategoryId.get(item.id) ?? []
            )

            return (
              <NavigationMenuItem key={category.id}>
                <NavigationMenuTrigger>{category.name}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  {productItems.length === 0 ? (
                    <div className="min-w-55 px-3 py-2 text-sm text-muted-foreground">
                      Žiadne produkty v tejto kategórii.
                    </div>
                  ) : (
                    <ul className="grid w-5xl grid-cols-3 gap-1">
                      {productItems.map((product) => (
                        <li key={product.id}>
                          <NavigationMenuLink asChild>
                            <Link href={`/product/${product.slug}`}>
                              {product.name}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </NavigationMenuContent>
              </NavigationMenuItem>
            )
          })
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl flex-col">
        <div className="flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/printexpert-logo.svg"
              alt="PrintExpert"
              width={140}
              height={32}
              priority
            />
            <span className="sr-only">PrintExpert</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth">Registrácia</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/account">Môj účet</Link>
              </Button>
            </div>
            <Suspense fallback={null}>
              <AudienceHeaderSwitch />
            </Suspense>
            <Suspense fallback={null}>
              <AudienceBadge />
            </Suspense>
          </div>
        </div>
        <div className="border-t">
          <div className="flex h-12 items-center px-4">
            <Suspense
              fallback={
                <div className="h-9 w-64 rounded-md bg-muted" aria-hidden />
              }
            >
              <AudienceNavigation />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  )
}
