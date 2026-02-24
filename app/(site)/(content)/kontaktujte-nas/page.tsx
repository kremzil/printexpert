import Link from "next/link"
import { Suspense } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card } from "@/components/ui/card"
import { ContactForm } from "@/components/print/contact-form"
import { ContactInfo } from "@/components/print/contact-info"
import { FAQSection } from "@/components/print/faq-section"
import { TeamShowcase } from "@/components/print/team-showcase"
import { resolveAudienceContext } from "@/lib/audience-context"
import {
  CheckCircle,
  Clock,
  FileText,
  Headphones,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react"
import { buildStaticPageMetadata, toJsonLd } from "@/lib/seo"

type ContactPageProps = {
  searchParams?: Promise<{ mode?: string }>
}

export const metadata = buildStaticPageMetadata("kontakt")

const team = [
  {
    image: "/team/sokol.webp",
    name: "Radoslav Sokol",
    role: "COO / Head of Sales",
    phone: "+421 917 226 194",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/ingrid.webp",
    name: "Ingrid Tereščíková",
    role: "Key Account Manager",
    phone: "+421 917 930 494",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/kanocz.webp",
    name: "Peter Kanócz",
    role: "Key Account Manager",
    phone: "+421 917 226 195",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/horvath.webp",
    name: "Ladislav Horvath",
    role: "Key Account Manager",
    phone: "+421 904 090 253",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/monika.webp",
    name: "Monika Juhászová",
    role: "Front Office / Customer Service",
    phone: "+421 917 545 003",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/milan.webp",
    name: "Milan Ďuroň",
    role: "Production / Store Manager",
    phone: "+421 905 919 714",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/tatiana.webp",
    name: "Tatiana Konečná",
    role: "Production Manager",
    phone: "+421 918 900 244",
    email: "info@printexpert.sk",
  },
  {
    image: "/team/dagmar.webp",
    name: "Dagmar Tereščíková",
    role: "Invoicing / Happiness Manager",
    phone: "+421 915 575 696",
    email: "info@printexpert.sk",
  },
]

export default function ContactPage({ searchParams }: ContactPageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Kontaktujte nás</h1>
          <p className="text-muted-foreground">Načítavame kontaktné údaje...</p>
        </div>
      }
    >
      <ContactPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ContactPageContent({ searchParams }: ContactPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const contactInfoItems = [
    {
      icon: Phone,
      label: mode === "b2c" ? "Zákaznícka linka" : "B2B hotline",
      value: "+421 917 545 003",
      href: "tel:+421917545003",
    },
    {
      icon: Mail,
      label: "E-mail",
      value: "info@printexpert.sk",
      href: "mailto:info@printexpert.sk",
    },
    {
      icon: MapPin,
      label: "Adresa",
      value: [
        "Prevádzka BA: Bojnická 3 83104 Bratislava",
        "Prevádzka KE: Rozvojová 2, 040 11 Košice (osobný odber)",
      ],
    },
    {
      icon: Clock,
      label: "Otváracie hodiny",
      value: "Po–Pi 08:00–17:00",
    },
  ]

  const faqItems =
    mode === "b2c"
      ? [
          {
            question: "Aké sú dodacie lehoty?",
            answer:
              "Štandardná dodacia lehota je 2-3 pracovné dni. Pri expresných objednávkach vieme zabezpečiť aj 24-hodinovú výrobu.",
          },
          {
            question: "Aké formáty súborov prijímate?",
            answer:
              "Akceptujeme PDF, AI, EPS, PSD a ďalšie grafické formáty. Odporúčame PDF v kvalite pre tlač s CMYK farbami.",
          },
          {
            question: "Ponúkate grafické služby?",
            answer:
              "Áno. Pomôžeme s návrhom vizitiek, letákov a ďalších tlačovín. Ceny vždy upresníme podľa zadania.",
          },
          {
            question: "Je možný osobný odber?",
            answer:
              "Áno, osobný odber je možný na našej pobočke v Košiciach alebo Bratislave.",
          },
        ]
      : [
          {
            question: "Ako funguje B2B spolupráca?",
            answer:
              "Každý B2B klient má k dispozícii account manažéra, ktorý pomáha s objednávkami a pripravuje individuálne ponuky.",
          },
          {
            question: "Ponúkate množstevné zľavy?",
            answer:
              "Áno. Pri väčších objemoch pripravíme individuálne cenové podmienky podľa rozsahu spolupráce.",
          },
          {
            question: "Môžeme žiadať fakturáciu?",
            answer:
              "Po overení údajov je možné nastaviť fakturáciu so splatnosťou podľa dohody.",
          },
          {
            question: "Pomôžete s technickou prípravou?",
            answer:
              "Áno. Naši prepress špecialisti skontrolujú súbory a poradia s technickými parametrami.",
          },
        ]

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <div className="space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(faqJsonLd) }}
      />
      <section className="text-center">
        <Breadcrumb className="mx-auto w-fit text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Domov</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Kontaktujte nás</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-4 text-4xl font-bold md:text-5xl">
          Kontaktujte nás
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {mode === "b2c"
            ? "Sme tu, aby sme vám pomohli s vašimi tlačovými projektami. Kontaktujte nás telefonicky, emailom alebo cez formulár."
            : "Náš B2B tím pripraví individuálne riešenie pre vašu firmu. Požiadajte o ponuku alebo sa obráťte na account manažéra."}
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactForm mode={mode} />
        </div>

        <div className="space-y-4">
          <ContactInfo mode={mode} items={contactInfoItems} />

          {mode === "b2b" ? (
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Potrebujete okamžitú pomoc?</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Headphones className="h-5 w-5" style={{ color: modeColor }} />
                  <span className="text-sm font-medium">Zavolať B2B špecialistu</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileText className="h-5 w-5" style={{ color: modeColor }} />
                  <span className="text-sm font-medium">Stiahnuť cenník</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Users className="h-5 w-5" style={{ color: modeColor }} />
                  <span className="text-sm font-medium">Môj account manažér</span>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold">Často kladené otázky</h2>
          <p className="text-lg text-muted-foreground">
            Odpovede na najčastejšie otázky našich {mode === "b2c" ? "zákazníkov" : "B2B partnerov"}
          </p>
        </div>
        <div className="mx-auto max-w-3xl">
          <FAQSection mode={mode} items={faqItems} />
        </div>
      </section>

      <section>
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold">Náš tím</h2>
          <p className="text-lg text-muted-foreground">
            Priamy kontakt na našich špecialistov.
          </p>
        </div>
        <TeamShowcase mode={mode} members={team} />
      </section>

      <section>
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold">Navštívte nás</h2>
          <p className="text-lg text-muted-foreground">
            Príďte si prezrieť vzorky a poradiť sa osobne s našimi špecialistami.
          </p>
        </div>
        <Card className="overflow-hidden">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d2632!2d21.2495546!3d48.693951!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNDjCsDQxJzM2LjMiTiAyMcKwMTQnNTguOSJF!5e0!3m2!1ssk!2ssk!4v1700000000000"
            width="100%"
            height="384"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="PrintExpert – Rozvojová 2, 040 11 Košice"
            className="h-96 w-full"
          />
        </Card>
      </section>

      <section>
        <Card
          className="overflow-hidden p-8 md:p-12"
          style={{
            background: `linear-gradient(135deg, ${modeAccent} 0%, ${modeColor}15 100%)`,
          }}
        >
          <div className="flex justify-center">
            <div className="text-center">
              <h2 className="mb-3 text-2xl font-bold md:text-3xl">
                {mode === "b2c"
                  ? "Začnite s vaším projektom dnes"
                  : "Staňte sa naším B2B partnerom"}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {mode === "b2c"
                  ? "Máte otázky alebo potrebujete radu? Náš tím je tu pre vás."
                  : "Získajte prístup k exkluzívnym B2B cenám, osobnému account manažérovi a prioritnej podpore."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="tel:+421917545003"
                  className="rounded-lg px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
                  style={{ backgroundColor: modeColor }}
                >
                  <Phone className="mr-2 inline h-5 w-5" />
                  Zavolať teraz
                </a>
                <a
                  href="mailto:info@printexpert.sk"
                  className="rounded-lg border-2 px-6 py-3 font-semibold transition-all hover:bg-white"
                  style={{ borderColor: modeColor, color: modeColor }}
                >
                  <Mail className="mr-2 inline h-5 w-5" />
                  Napísať email
                </a>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            "Kontrola súborov v cene",
            "Bezpečná platba",
            "Expresné dodanie",
          ].map((item) => (
            <Card key={item} className="p-6 text-center">
              <div className="mb-3 flex justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 font-semibold">{item}</h3>
              <p className="text-sm text-muted-foreground">
                {item === "Kontrola súborov v cene"
                  ? "Každý súbor prejde kontrolou pred tlačou"
                  : item === "Bezpečná platba"
                    ? "SSL šifrovanie a overené platobné brány"
                    : "Výroba do 2-3 dní + doprava"}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
