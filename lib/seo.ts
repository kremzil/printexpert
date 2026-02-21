import type { Metadata } from "next"

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"
const normalizedSiteUrl = rawSiteUrl.endsWith("/")
  ? rawSiteUrl.slice(0, -1)
  : rawSiteUrl

export const SITE_URL = normalizedSiteUrl
export const SITE_NAME = "PrintExpert"
export const SITE_DESCRIPTION =
  "Profesionálna online tlač pre firmy aj domácnosti. Vizitky, letáky, bannery, polepy a ďalšie tlačové produkty s rýchlym doručením."
export const DEFAULT_OG_IMAGE = "/printexpert-logo.png"

export const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
}

type SeoPageDefinition = {
  title: string
  description: string
  canonicalPath: string
  openGraphTitle?: string
  openGraphDescription?: string
  noindex?: boolean
}

const SEO_PAGES = {
  home: {
    title: "Online tlač pre firmy aj domácnosti",
    description:
      "PrintExpert ponúka online tlač vizitiek, letákov, bannerov, polepov a ďalších tlačových produktov s rýchlym doručením po celom Slovensku.",
    canonicalPath: "/",
    openGraphTitle: `Online tlač pre firmy aj domácnosti | ${SITE_NAME}`,
    openGraphDescription:
      "Objednajte profesionálnu tlač online. Kvalitná výroba, expresné termíny a podpora pre B2C aj B2B zákazníkov.",
  },
  doprava: {
    title: "Doprava",
    description:
      "Informácie o doručení objednávok, osobnom odbere a kuriérskej doprave pre zákazníkov PrintExpert.",
    canonicalPath: "/doprava",
  },
  kontakt: {
    title: "Kontaktujte nás",
    description:
      "Kontakt na tím PrintExpert, zákaznícka podpora, B2B hotline, prevádzky a často kladené otázky.",
    canonicalPath: "/kontaktujte-nas",
    openGraphTitle: `Kontaktujte nás | ${SITE_NAME}`,
    openGraphDescription:
      "Potrebujete pomoc s objednávkou alebo cenovou ponukou? Kontaktujte tím PrintExpert telefonicky alebo e-mailom.",
  },
  kategorie: {
    title: "Kategórie produktov",
    description:
      "Prehľad kategórií tlačových produktov PrintExpert. Vyberte kategóriu a nájdite vhodné riešenie pre vašu tlač.",
    canonicalPath: "/kategorie",
  },
  obchodnePodmienky: {
    title: "Obchodné podmienky",
    description:
      "Obchodné podmienky internetového obchodu PrintExpert vrátane dodacích, reklamačných a platobných pravidiel.",
    canonicalPath: "/obchodne-podmienky",
  },
  ochranaOsobnychUdajov: {
    title: "Ochrana osobných údajov",
    description:
      "Informácie o spracúvaní a ochrane osobných údajov zákazníkov PrintExpert v súlade s GDPR.",
    canonicalPath: "/ochrana-osobnych-udajov",
  },
  vratenieTovaru: {
    title: "Vrátenie tovaru",
    description:
      "Podmienky vrátenia tovaru vyrobeného na mieru a kontakt na zákaznícku podporu PrintExpert.",
    canonicalPath: "/vratenie-tovaru",
  },
  checkout: {
    title: "Pokladňa",
    description: "Dokončenie objednávky",
    canonicalPath: "/checkout",
    noindex: true,
  },
  cart: {
    title: "Košík",
    description: "Nákupný košík",
    canonicalPath: "/cart",
    noindex: true,
  },
  accountOrders: {
    title: "Moje objednávky",
    description: "História objednávok",
    canonicalPath: "/account/orders",
    noindex: true,
  },
  accountSavedCarts: {
    title: "Uložené košíky",
    description: "Uložené košíky pre B2B zákazníkov",
    canonicalPath: "/account/saved-carts",
    noindex: true,
  },
  dashboard: {
    title: "Dashboard",
    description: "Interný prehľad účtu",
    canonicalPath: "/dashboard",
    noindex: true,
  },
} as const satisfies Record<string, SeoPageDefinition>

export type SeoPageKey = keyof typeof SEO_PAGES

export const buildStaticPageMetadata = (pageKey: SeoPageKey): Metadata => {
  const page: SeoPageDefinition = SEO_PAGES[pageKey]
  const ogTitle = page.openGraphTitle ?? `${page.title} | ${SITE_NAME}`
  const ogDescription = page.openGraphDescription ?? page.description
  const metadata: Metadata = {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: page.canonicalPath,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: page.canonicalPath,
    },
  }

  if (page.noindex) {
    metadata.robots = NOINDEX_ROBOTS
  }

  return metadata
}

export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "sk_SK",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const toCanonicalUrl = (path: string) => new URL(path, `${SITE_URL}/`)

export const toAbsoluteUrl = (path: string) =>
  new URL(path, `${SITE_URL}/`).toString()

export const toJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c")
