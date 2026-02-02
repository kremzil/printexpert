import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { Menu, ChevronDown } from "lucide-react"
import { unstable_cache } from "next/cache"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { ModeButton } from "@/components/print/mode-button"
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
import { auth } from "@/auth"
import { SiteHeaderClient } from "./site-header-client"

const MAX_PRODUCTS_PER_SUBCATEGORY = 6
const MAX_PRODUCTS_PER_CATEGORY = 12

// Кэшированный запрос навигационных данных (5 минут)
const getCachedNavData = unstable_cache(
  async (audience: "b2b" | "b2c" | null) => {
    const prisma = getPrisma()
    const audienceFilter =
      audience === "b2b"
        ? { showInB2b: true }
        : audience === "b2c"
          ? { showInB2c: true }
          : {}
    const productAudienceFilter =
      audience === "b2b"
        ? { showInB2b: true }
        : audience === "b2c"
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

    const childrenByParentId = categories.reduce((map, category) => {
      const key = category.parentId ?? "root"
      const list = map.get(key) ?? []
      list.push(category)
      map.set(key, list)
      return map
    }, new Map<string, typeof categories>())
    const rootCategories = childrenByParentId.get("root") ?? []

    const limitByCategoryId = new Map<string, number>()
    rootCategories.forEach((category) => {
      const children = childrenByParentId.get(category.id) ?? []
      if (children.length > 0) {
        children.forEach((child) =>
          limitByCategoryId.set(child.id, MAX_PRODUCTS_PER_SUBCATEGORY)
        )
      } else {
        limitByCategoryId.set(category.id, MAX_PRODUCTS_PER_CATEGORY)
      }
    })

    const productBatches = await Promise.all(
      Array.from(limitByCategoryId.entries()).map(([categoryId, take]) =>
        prisma.product.findMany({
          where: {
            isActive: true,
            ...productAudienceFilter,
            categoryId,
            category: {
              isActive: true,
              ...audienceFilter,
            },
          },
          orderBy: [{ name: "asc" }],
          take,
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
            priceFrom: true,
          },
        })
      )
    )

    const productsByCategoryId: Record<
      string,
      typeof productBatches[number][number][]
    > = {}
    productBatches.flat().forEach((product) => {
      const list = productsByCategoryId[product.categoryId] ?? []
      list.push(product)
      productsByCategoryId[product.categoryId] = list
    })

    return { categories, productsByCategoryId }
  },
  ["nav-data"],
  { revalidate: 300, tags: ["nav-data"] }
)

async function AudienceHeaderSwitch() {
  const audienceContext = await resolveAudienceContext()
  if (audienceContext.source === "default") {
    return null
  }
  return <AudienceModeSwitch initialAudience={audienceContext.audience} />
}

async function AudienceNavigation() {
  const audienceContext = await resolveAudienceContext()
  const { categories, productsByCategoryId } = await getCachedNavData(
    audienceContext.audience
  )
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
            const hasSubcategories = children.length > 0
            
            // If we have subcategories, we group products by them.
            // If not, we just show the products of the root category.
            const sections = hasSubcategories 
              ? children.map(child => ({
                  id: child.id,
                  name: child.name,
                  slug: child.slug,
                  products: productsByCategoryId[child.id] ?? []
                })).filter(section => section.products.length > 0)
              : [{
                  id: category.id,
                  name: category.name,
                  slug: category.slug,
                  products: productsByCategoryId[category.id] ?? []
                }]

            // If no products at all in this branch, maybe skip rendering or show "No products"
            const totalProducts = sections.reduce((acc, s) => acc + s.products.length, 0)

            return (
              <NavigationMenuItem key={category.id}>
                <NavigationMenuTrigger className="bg-transparent hover:bg-secondary/50 data-[state=open]:bg-secondary/50 font-medium">
                  {category.name}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-200 p-4 lg:w-200">
                    <div className="flex items-center justify-between border-b pb-4 mb-4">
                      <div className="space-y-1">
                        <h4 className="text-lg font-medium leading-none">{category.name}</h4>
                        <p className="text-sm text-muted-foreground leading-snug">
                          Vyberte si z našej ponuky {category.name.toLowerCase()}
                        </p>
                      </div>
                      <Link 
                        href={`/kategorie?cat=${category.slug}`}
                        className="text-sm font-medium text-primary hover:underline hover:underline-offset-4 flex items-center gap-1"
                      >
                        Všetky {category.name.toLowerCase()}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>

                    {totalProducts === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        Momentálne nedostupné žiadne produkty.
                      </div>
                    ) : (
                      <div className={hasSubcategories ? "columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 block" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"}>
                        {sections.map((section) => (
                          <div 
                            key={section.id} 
                            className={hasSubcategories ? "break-inside-avoid mb-6 space-y-3" : "contents"}
                          >
                            {hasSubcategories && (
                              <Link 
                                href={`/kategorie?cat=${section.slug}`}
                                className="block font-semibold text-foreground/90 hover:text-primary transition-colors mb-2"
                              >
                                {section.name}
                              </Link>
                            )}
                            
                            {hasSubcategories ? (
                              <ul className="space-y-2">
                                {section.products.slice(0, 6).map((product) => (
                                  <li key={product.id}>
                                    <NavigationMenuLink asChild>
                                      <Link
                                        href={`/product/${product.slug}`}
                                        className="block rounded-md p-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                      >
                                        <div className="font-medium leading-none mb-1">{product.name}</div>
                                      </Link>
                                    </NavigationMenuLink>
                                  </li>
                                ))}
                                {section.products.length > 6 && (
                                  <li>
                                    <NavigationMenuLink asChild>
                                      <Link
                                        href={`/kategorie?cat=${section.slug}`}
                                        className="block rounded-md p-2 text-sm font-medium text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors"
                                      >
                                        Zobraziť viac...
                                      </Link>
                                    </NavigationMenuLink>
                                  </li>
                                )}
                              </ul>
                            ) : (
                              <>
                                {section.products.slice(0, 12).map((product) => (
                                  <NavigationMenuLink key={product.id} asChild>
                                    <Link
                                      href={`/product/${product.slug}`}
                                      className="group flex flex-col items-center justify-center text-center gap-1.5 rounded-lg border p-3 hover:bg-accent hover:text-accent-foreground transition-colors h-full"
                                    >
                                        <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">{product.name}</span>
                                        <span className="text-xs text-muted-foreground">Od {product.priceFrom ? `${product.priceFrom} €` : 'Vyžiadanie'}</span>
                                    </Link>
                                  </NavigationMenuLink>
                                ))}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
  const { categories, productsByCategoryId } = await getCachedNavData(
    audienceContext.audience
  )
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
        <ModeButton variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Otvoriť menu</span>
        </ModeButton>
      </SheetTrigger>
      <SheetContent side="left" className="w-75 sm:w-100 flex flex-col">
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
                productsByCategoryId[item.id] ?? []
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

import { HeaderSearch } from "@/components/header-search"

export async function SiteHeader() {
  const session = await auth()
  return (
    <SiteHeaderClient
      topBar={
        <>
          {/* Left: Logo + Search */}
          <div className="flex items-center gap-6">
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
                  width={180}
                  height={40}
                  priority
                  className="transition-transform duration-300 ease-in-out group-hover:opacity-90"
                />
                <div className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </div>
              <span className="sr-only">PrintExpert</span>
            </Link>
            
            <HeaderSearch />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Suspense fallback={null}>
              <AudienceHeaderSwitch />
            </Suspense>

            <div className="h-6 w-px bg-border/50 hidden sm:block" />

            <div className="hidden items-center gap-2 lg:flex">
              {!session?.user && (
                <ModeButton asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Link href="/auth/register">Registrácia</Link>
                </ModeButton>
              )}
              <ModeButton asChild variant="outline" size="sm" className="rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5">
                <Link href="/account">Môj účet</Link>
              </ModeButton>
            </div>

            <CartButton />
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
