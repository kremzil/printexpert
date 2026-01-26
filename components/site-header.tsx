import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { Menu, ChevronDown } from "lucide-react"

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AudienceModeSwitch } from "@/components/audience-mode-switch"
import { CartButton } from "@/components/cart/cart-button"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getPrisma } from "@/lib/prisma"
import { SiteHeaderClient } from "./site-header-client"

async function AudienceBadge() {
  const audienceContext = await resolveAudienceContext()
  const label =
    audienceContext.source === "default"
      ? "Vyberte režim"
      : audienceContext.audience === "b2b"
        ? "Pre firmy"
        : "Pre jednotlivcov"
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-semibold text-primary sm:text-xs backdrop-blur-sm">
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

async function MobileMenu() {
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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Otvoriť menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>
            Navigujte cez kategórie a produkty
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-2 overflow-y-auto flex-1">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Domov
          </Link>
          {rootCategories.length === 0 ? (
            <Link
              href="/kategorie"
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Kategórie
            </Link>
          ) : (
            rootCategories.map((category) => {
              const children = childrenByParentId.get(category.id) ?? []
              const items = children.length > 0 ? children : [category]
              const productItems = items.flatMap((item) =>
                productsByCategoryId.get(item.id) ?? []
              )

              return (
                <Collapsible key={category.id} className="border-b border-border/50 pb-2">
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold hover:bg-accent">
                    <span>{category.name}</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    {productItems.length === 0 ? (
                      <div className="px-3 py-1 text-sm text-muted-foreground">
                        Žiadne produkty v tejto kategórii.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 pl-3">
                        {productItems.map((product) => (
                          <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className="rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                          >
                            {product.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function SiteHeader() {
  return (
    <SiteHeaderClient
      topBar={
        <>
          <div className="flex items-center gap-4">
            <Suspense fallback={null}>
              <MobileMenu />
            </Suspense>
            <Link 
              href="/" 
              className="group flex items-center gap-2 transition-transform duration-300 hover:scale-105"
            >
              <div className="relative site-header-logo">
                <Image
                  src="/printexpert-logo.svg"
                  alt="PrintExpert"
                  width={160}
                  height={36}
                  priority
                  className="transition-transform duration-300 ease-in-out group-hover:opacity-90"
                />
                <div className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </div>
              <span className="sr-only">PrintExpert</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <CartButton />
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm" className="ink-spread">
                <Link href="/auth">Registrácia</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="print-frame">
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
        </>
      }
      navBar={
        <Suspense
          fallback={
            <div className="h-9 w-64 rounded-md bg-muted animate-pulse" aria-hidden />
          }
        >
          <AudienceNavigation />
        </Suspense>
      }
    />
  )
}
