import Image from "next/image"
import Link from "next/link"
import {
  Award,
  CheckCircle,
  FileCheck,
  FileText,
  Headphones,
  Mail,
  Phone,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Upload,
  User,
  Quote,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { ProductCard } from "@/components/product/product-card"
import type { CustomerMode } from "@/components/print/types"
import { HeroCarousel } from "@/components/print/hero-carousel"
import { cn } from "@/lib/utils"

type CategoryCardData = {
  id: string
  slug: string
  name: string
  description?: string | null
  image: string
  productCount: number
}

type FeaturedProduct = {
  id: string
  slug: string
  name: string
  excerpt?: string | null
  description?: string | null
  priceFrom?: string | null
  priceAfterDiscountFrom?: string | null
  feedPrice?: number | null
  images?: Array<{ url: string; alt?: string | null }>
}

type CollectionCardData = {
  id: string
  slug: string
  name: string
  image: string
  description?: string | null
}

type HomepageProps = {
  mode: CustomerMode
  categories: CategoryCardData[]
  featuredProducts: FeaturedProduct[]
  collections: CollectionCardData[]
}

type ProcessStep = {
  number: number
  icon: LucideIcon
  title: string
  description: string
}

type Testimonial = {
  name: string
  role: string
  company?: string
  text: string
  rating: number
}

export function Homepage({ mode, categories, featuredProducts, collections }: HomepageProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"
  const mutedSectionBg = "bg-[rgba(236,236,240,0.3)]"
  const hasOddCollections = collections.length % 2 !== 0

  const steps: ProcessStep[] =
    mode === "b2c"
      ? [
          {
            number: 1,
            icon: ShoppingBag,
            title: "Vyberte produkt",
            description: "Nakonfigurujte si produkt podľa vašich potrieb",
          },
          {
            number: 2,
            icon: Upload,
            title: "Nahrajte súbory",
            description: "Presuňte vaše dizajny priamo na web",
          },
          {
            number: 3,
            icon: Truck,
            title: "Doručenie",
            description: "Expresná expedícia do 48 hodín",
          },
        ]
      : [
          {
            number: 1,
            icon: User,
            title: "Kontakt",
            description: "Kontaktujte nás pre cenovú ponuku",
          },
          {
            number: 2,
            icon: FileText,
            title: "Cenová ponuka",
            description: "Pripravíme ponuku na mieru",
          },
          {
            number: 3,
            icon: CheckCircle,
            title: "Príprava podkladov",
            description: "Profesionálna príprava podkladov",
          },
          {
            number: 4,
            icon: Truck,
            title: "Flexibilná logistika",
            description: "Kuriér, osobný odber alebo vlastná doprava",
          },
        ]

  const testimonials: Testimonial[] =
    mode === "b2c"
      ? [
          {
            name: "Peter Novák",
            role: "Podnikateľ",
            text: "Super rýchle dodanie a kvalita vizitiek ma príjemne prekvapila. Určite objednám znova.",
            rating: 5,
          },
          {
            name: "Mária Kováčová",
            role: "Grafický dizajnér",
            text: "Farby sú presne také ako v mojom dizajne. Kontrola súborov zadarmo je skvelý bonus.",
            rating: 5,
          },
          {
            name: "Ján Horváth",
            role: "Živnostník",
            text: "Jednoduché objednávanie a výborná komunikácia. Letáky prišli za 2 dni.",
            rating: 5,
          },
        ]
      : [
          {
            name: "Ing. Katarína Novotná",
            role: "Marketing Manager",
            company: "Tech Solutions s.r.o.",
            text: "Náš osobný manažér vždy rýchlo reaguje a pomáha s optimalizáciou objednávok. Objemové zľavy sú výhodné.",
            rating: 5,
          },
          {
            name: "Martin Štefan",
            role: "Konateľ",
            company: "Creative Agency",
            text: "Spolupracujeme už 3 roky a nikdy sme neboli sklamaní. Prepress tím je profesionálny.",
            rating: 5,
          },
          {
            name: "Eva Macková",
            role: "Purchasing Manager",
            company: "Retail Chain",
            text: "Archivácia podkladov a opakované objednávky sú veľmi praktické. Ušetrí to čas.",
            rating: 5,
          },
        ]

  return (
    <div className="w-full">
      <div className="min-h-screen">
        <HeroSection mode={mode} modeColor={modeColor} modeAccent={modeAccent} />

        <section className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              Kategórie produktov
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Vyberte si z našej širokej ponuky tlačových produktov pre každú
              príležitosť
            </p>
          </div>

          <Carousel
            opts={{ align: "start", loop: false }}
            className="relative"
          >
            <CarouselContent className="-ml-4">
              {categories.map((category) => (
                <CarouselItem
                  key={category.id}
                  className="pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/5"
                >
                  <CategoryCard
                    modeColor={modeColor}
                    category={category}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className= "-left-4" />
            <CarouselNext className= "-right-4" />
          </Carousel>
        </section>

        {collections.length > 0 && (
          <section className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-3xl font-bold md:text-4xl">Kolekcie</h2>
                <p className="max-w-2xl text-muted-foreground">
                  Vybrané tematické kolekcie produktov pre rýchlejší výber.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[165px]">
              {collections.map((collection, index) => {
                const isLastOddCollection = hasOddCollections && index === collections.length - 1

                return (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    isWide={isLastOddCollection}
                    className={
                      isLastOddCollection
                        ? "col-span-1 row-span-1 lg:col-span-2 lg:row-span-2"
                        : "col-span-1 row-span-1"
                    }
                  />
                )
              })}
            </div>
          </section>
        )}

        <section
          className={`relative left-1/2 right-1/2 w-screen -translate-x-1/2 ${mutedSectionBg} py-16`}
        >
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  <Badge variant="secondary">Najobľúbenejšie</Badge>
                </div>
                <h2 className="text-3xl font-bold md:text-4xl">
                  {mode === "b2c"
                    ? "Bestsellery"
                    : "Najpredávanejšie produkty pre firmy"}
                </h2>
              </div>
              <Link
                href="/catalog"
                className="text-sm font-medium hover:underline"
                style={{ color: modeColor }}
              >
                Zobraziť všetko →
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} mode={mode} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              {mode === "b2c" ? "Ako to funguje?" : "Proces spolupráce"}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {mode === "b2c"
                ? "Jednoduché objednávanie v 3 krokoch - od výberu po doručenie"
                : "Profesionálny prístup ku každému B2B klientovi"}
            </p>
          </div>

          <ProcessSteps modeColor={modeColor} modeAccent={modeAccent} steps={steps} />
        </section>

        <section
          className={`relative left-1/2 right-1/2 w-screen -translate-x-1/2 ${mutedSectionBg} py-16`}
        >
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold md:text-4xl">
                Prečo Printexpert?
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Kvalita, rýchlosť a spoľahlivosť, na ktorú sa môžete spoľahnúť
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {(mode === "b2c"
                ? [
                    {
                      icon: Truck,
                      title: "Rýchle doručenie",
                      description: "Expedícia do 24-48 hodín",
                    },
                    {
                      icon: Shield,
                      title: "Garancia kvality",
                      description: "100% spokojnosť alebo peniaze späť",
                    },
                    {
                      icon: CheckCircle,
                      title: "Kontrola súborov",
                      description: "Zadarmo overíme vaše podklady",
                    },
                    {
                      icon: FileText,
                      title: "Prémiové materiály",
                      description: "Len overení dodávatelia",
                    },
                  ]
                : [
                    {
                      icon: CheckCircle,
                      title: "Profesionálny prepress",
                      description: "Kontrola a úprava súborov zadarmo",
                    },
                    {
                      icon: FileText,
                      title: "Archivácia podkladov",
                      description: "Dlhodobé uloženie pre opakovanie objednávok",
                    },
                    {
                      icon: Headphones,
                      title: "Osobný manažér",
                      description: "Priamy kontakt na vášho obchodníka",
                    },
                    {
                      icon: Truck,
                      title: "Flexibilná logistika",
                      description: "Osobný odber, kuriér, vlastná doprava",
                    },
                  ]
              ).map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full"
                      style={{ backgroundColor: modeAccent }}
                    >
                      <Icon className="h-8 w-8" style={{ color: modeColor }} />
                    </div>
                    <div>
                      <div className="mb-1 font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              Čo hovoria naši klienti
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {mode === "b2c"
                ? "Spokojnosť viac ako 15 000 zákazníkov"
                : "Dôvera viac ako 500 firemných klientov"}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard
                key={index}
                modeColor={modeColor}
                modeAccent={modeAccent}
                testimonial={testimonial}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
          <CTASection mode={mode} modeColor={modeColor} modeAccent={modeAccent} />
        </section>
      </div>
    </div>
  )
}

function HeroSection({
  mode,
  modeColor,
  modeAccent,
}: {
  mode: CustomerMode
  modeColor: string
  modeAccent: string
}) {
  const isB2C = mode === "b2c"
  const heroSlides = isB2C
    ? [
        {
          src: "/homepage/b2c/b2c-1.webp",
          alt: "Veľky fotoobr s rodinou",
        },
        {
          src: "/homepage/b2c/b2c-2.webp",
          alt: "Nalálepky na stenu do detskej izby",
        },
        {
          src: "/homepage/b2c/b2c-3.webp",
          alt: "Rohožka pri vchode do domu",
        },
      ]
    : [
        {
          src: "/homepage/b2b/nalepka.webp",
          alt: "Tlačoviny pre váš biznis",
        },
        {
          src: "/homepage/b2b/banner.webp",
          alt: "Bannery od 6.66 eur",
        },
        {
          src: "/homepage/b2b/rollup.webp",
          alt: "Rollup od 41.66 eur",
        },
      ]

  return (
    <section
      className={`relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden py-16 md:py-24 ${
        isB2C
          ? "bg-gradient-to-br from-red-50 via-orange-50 to-white"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
      }`}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-6">
            <div
              className="inline-block rounded-full px-4 py-1.5 text-sm font-medium"
              style={{ backgroundColor: modeAccent, color: modeColor }}
            >
              {isB2C
                ? "✨ Expresná výroba do 48 hodín"
                : "💼 Profesionálne B2B riešenia"}
            </div>

            <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              {isB2C ? "Profesionálna tlač " : "Tlačové služby "}
              <span style={{ color: modeColor }}>
                {isB2C ? "pre každého" : "pre vaše podnikanie"}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground md:text-xl">
              {isB2C
                ? "Od vizitiek po veľkoformátové plagáty. Vysoká kvalita, nízke ceny a dodanie už do 24 hodín. Objednajte online za pár kliknutí."
                : "Komplexné tlačové riešenia pre firmy. Osobný manažér, objemové zľavy, fakturácia, archivácia podkladov a flexibilná logistika."}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-lg font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                style={{ backgroundColor: modeColor }}
              >
                {isB2C ? "Začať nakupovať" : "Požiadať o cenovú ponuku"}
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-lg border-2 bg-white px-8 py-3.5 text-lg font-medium transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ borderColor: modeColor, color: modeColor }}
              >
                {isB2C ? "Pozrieť produkty" : "Katalóg produktov"}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6">
              {(isB2C
                ? [
                    { value: "24h", label: "Expresná výroba" },
                    { value: "15K+", label: "Spokojných zákazníkov" },
                    { value: "4.9★", label: "Hodnotenie" },
                  ]
                : [
                    { value: "500+", label: "Firemných klientov" },
                    { value: "-45%", label: "Objemové zľavy" },
                    { value: "24/7", label: "Online podpora" },
                  ]
              ).map((item) => (
                <div key={item.label}>
                  <div
                    className="text-2xl font-bold md:text-3xl"
                    style={{ color: modeColor }}
                  >
                    {item.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <HeroCarousel slides={heroSlides} activeColor={modeColor} />

            <div className="absolute -bottom-4 -left-4 rounded-lg bg-white p-4 shadow-lg md:p-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: modeAccent }}
                >
                  <FileCheck className="h-6 w-6" style={{ color: modeColor }} />
                </div>
                <div>
                  <div className="font-semibold">
                    {isB2C ? "Kontrola súborov" : "Osobný manažér"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isB2C
                      ? "Zadarmo"
                      : "Priradený ku každému klientu"}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 rounded-lg bg-white p-4 shadow-lg">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5" style={{ color: modeColor }} />
                <span className="font-semibold">
                  {isB2C ? "Prémiová kvalita" : "ISO 9001 certifikát"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CategoryCard({
  category,
  modeColor,
}: {
  category: CategoryCardData
  modeColor: string
}) {
  return (
    <Link
      href={`/kategorie/${category.slug}`}
      className="group relative block h-100 overflow-hidden rounded-xl border border-border text-left transition-all hover:border-muted-foreground hover:shadow-lg"
    >
      <Image
        src={category.image}
        alt={category.name}
        fill
        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-b from-white to-transparent shadow-lg">
        <FileText className="h-6 w-6" style={{ color: modeColor }} />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
        <h3 className="mb-2 text-lg font-semibold">{category.name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">
            {category.productCount} produktov
          </span>
          <span className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2">
            Zobraziť
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function CollectionCard({
  collection,
  isWide,
  className,
}: {
  collection: CollectionCardData
  isWide: boolean
  className?: string
}) {
  return (
    <Link
      href={`/kolekcie/${collection.slug}`}
      className={cn(
        "group relative block h-[150px] overflow-hidden rounded-xl border border-border transition-all hover:border-muted-foreground hover:shadow-lg lg:h-full",
        className,
      )}
    >
      <Image
        src={collection.image}
        alt={collection.name}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover object-bottom-left  lg:object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 top-0 bg-black/60 px-4 py-2.5 sm:hidden">
        <h3 className="text-base font-semibold leading-tight text-white">{collection.name}</h3>
      </div>
      <div className="absolute inset-0 hidden items-center justify-end p-5 sm:flex sm:p-6">
        <div
          className={cn(
            "text-left text-white",
            isWide ? "w-[56%] sm:w-[50%] lg:w-[40%]" : "w-[56%] sm:w-[50%] lg:w-[46%]",
          )}
        >
          <h3
            className={cn(
              "font-semibold leading-tight",
              isWide ? "mb-2 lg:mb-4 text-2xl lg:text-4xl" : "mb-1 lg:mb-2 text-xl lg:text-2xl",
            )}
          >
            {collection.name}
          </h3>
          {collection.description ? (
            <p
              className={cn(
                "leading-relaxed text-white/90",
                isWide ? "line-clamp-3 text-sm lg:text-lg" : "line-clamp-2 text-sm lg:text-base",
              )}
            >
              {collection.description}
            </p>
          ) : (
            <p className={cn("text-white/85", isWide ? "text-sm lg:text-base" : "text-sm")}>
              Vybraná kolekcia produktov.
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function ProcessSteps({
  steps,
  modeColor,
  modeAccent,
}: {
  steps: ProcessStep[]
  modeColor: string
  modeAccent: string
}) {
  const gridColsClass = steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"

  return (
    <div className={`grid gap-8 md:grid-cols-2 ${gridColsClass}`}>
      {steps.map((step, index) => {
        const Icon = step.icon
        return (
          <div key={index} className="relative">
            {index < steps.length - 1 && (
              <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-border lg:block" />
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              <div
                className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white shadow-lg"
                style={{ backgroundColor: modeAccent }}
              >
                <Icon className="h-10 w-10" style={{ color: modeColor }} />
              </div>

              <div
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: modeColor }}
              >
                {step.number}
              </div>

              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TestimonialCard({
  testimonial,
  modeColor,
  modeAccent,
}: {
  testimonial: Testimonial
  modeColor: string
  modeAccent: string
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="absolute -left-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: modeAccent }}
      >
        <Quote className="h-5 w-5" style={{ color: modeColor }} />
      </div>

      <div className="mb-4 flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < testimonial.rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
      </div>

      <p className="mb-6 italic text-muted-foreground">
        &ldquo;{testimonial.text}&rdquo;
      </p>

      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: modeColor }}
        >
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold">{testimonial.name}</div>
          <div className="text-sm text-muted-foreground">
            {testimonial.role}
            {testimonial.company ? ` • ${testimonial.company}` : ""}
          </div>
        </div>
      </div>
    </div>
  )
}

function CTASection({
  mode,
  modeColor,
}: {
  mode: CustomerMode
  modeColor: string
  modeAccent: string
}) {
  if (mode === "b2c") {
    return (
      <section
        className="relative overflow-hidden rounded-2xl py-16 md:py-20"
        style={{ backgroundColor: modeColor }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white" />
        </div>

        <div className="relative text-center text-white">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
            Pripravení začať tlačiť?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg opacity-90 md:text-xl">
            Objednajte si profesionálnu tlač online za pár minút. Kvalita
            zaručená a expresné dodanie.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-lg font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              style={{ color: modeColor }}
            >
              Začať nakupovať
            </Link>
            <Link
              href="/kontaktujte-nas"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white bg-transparent px-8 py-3.5 text-lg font-medium text-white transition-all hover:bg-white/10"
            >
              Kontaktovať nás
            </Link>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { value: "24h", label: "Expresná tlač" },
              { value: "100%", label: "Záruka kvality" },
              { value: "15K+", label: "Spokojných zákazníkov" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-white/10 p-6 backdrop-blur-sm"
              >
                <div className="mb-2 text-3xl font-bold">{item.value}</div>
                <div className="opacity-90">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl py-16 md:py-20"
      style={{ backgroundColor: modeColor }}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white" />
      </div>

      <div className="relative text-white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="ml-6">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
              Potrebujete B2B tlačové riešenie?
            </h2>
            <p className="mb-8 text-lg opacity-90 md:text-xl">
              Získajte prístup k objemovým zľavám, osobnému manažérovi a
              profesionálnej podpore pre vaše podnikanie.
            </p>

            <div className="mb-8 flex flex-wrap gap-4">
              <Link
                href="/kontaktujte-nas"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-lg font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                style={{ color: modeColor }}
              >
                Požiadať o cenovú ponuku
              </Link>
            </div>

            <div className="space-y-3 opacity-90">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5" />
                <span>+421 917 545 003</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                <span>info@printexpert.sk</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { value: "-45%", label: "Maximálna zľava pri objemoch" },
              { value: "500+", label: "Firemných klientov" },
              { value: "24/7", label: "Online podpora" },
              { value: "ISO 9001", label: "Certifikovaná kvalita" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-white/10 p-6 backdrop-blur-sm"
              >
                <div className="mb-2 text-3xl font-bold">{item.value}</div>
                <div className="opacity-90">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
