import type { Category } from "@/types/category"

export const categories: Category[] = [
  {
    slug: "male-formaty",
    name: "Malé formáty",
    description: "Vizitky, letáky, svadobné tlačoviny a darčekové poukazy.",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "velke-formaty",
    name: "Veľké formáty",
    description: "Bannery, billboardy, citylight a ďalšie exteriérové riešenia.",
    image: "/products/velkeFormaty/banner.webp",
  },
  {
    slug: "pos",
    name: "Prezentačné systémy",
    description: "Roll-upy, promo stolíky, visačky a magnetické fólie.",
    image: "/products/pos/rollUp.webp",
  },
  {
    slug: "peciatky",
    name: "Pečiatky",
    description: "Štandardné, podlhovasté, štvorcové, okrúhle a oválne pečiatky.",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "peciatky-standardne",
    name: "Pečiatky Štandardné",
    parentSlug: "peciatky",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "peciatky-podlhovaste",
    name: "Pečiatky Podlhovasté",
    parentSlug: "peciatky",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "peciatky-stvorcove",
    name: "Pečiatky Štvorcové",
    parentSlug: "peciatky",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "peciatky-okruhle",
    name: "Pečiatky Okrúhle",
    parentSlug: "peciatky",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "peciatky-ovalne",
    name: "Pečiatky Oválne",
    parentSlug: "peciatky",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "rohoze",
    name: "Rohože",
    image: "/products/maleFormaty/vizitky.webp",
  },
  {
    slug: "foto-a-obrazy",
    name: "Foto a obrazy",
    image: "/products/maleFormaty/plagaty.webp",
  },
  {
    slug: "vlajky",
    name: "Vlajky",
    image: "/products/velkeFormaty/banner.webp",
  },
  {
    slug: "nalepky-a-etikety",
    name: "Nálepky a etikety",
    image: "/products/maleFormaty/vizitky.webp",
  },
]
