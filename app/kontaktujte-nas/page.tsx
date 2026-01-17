import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ContactForm } from "@/components/contact-form"

const team = [
  {
    name: "Radoslav Sokol",
    role: "COO / Head of Sales",
    phone: "+421 917 226 194",
    email: "info@printexpert.sk",
  },
  {
    name: "Ingrid Tereščíková",
    role: "Key Account Manager",
    phone: "+421 917 930 494",
    email: "info@printexpert.sk",
  },
  {
    name: "Peter Kanócz",
    role: "Key Account Manager",
    phone: "+421 917 226 195",
    email: "info@printexpert.sk",
  },
  {
    name: "Ladislav Horvath",
    role: "Key Account Manager",
    phone: "+421 904 090 253",
    email: "info@printexpert.sk",
  },
  {
    name: "Monika Juhászová",
    role: "Front Office / Customer Service",
    phone: "+421 917 545 003",
    email: "info@printexpert.sk",
  },
  {
    name: "Milan Ďuroň",
    role: "Production / Store Manager",
    phone: "+421 905 919 714",
    email: "info@printexpert.sk",
  },
  {
    name: "Tatiana Konečná",
    role: "Production Manager",
    phone: "+421 918 900 244",
    email: "info@printexpert.sk",
  },
  {
    name: "Dagmar Tereščíková",
    role: "Invoicing / Happiness Manager",
    phone: "+421 915 575 696",
    email: "info@printexpert.sk",
  },
]

const contactBlocks = [
  {
    title: "Telefón",
    value: "+421 917 545 003",
    icon: (
      <path d="M20.4 15.5a14.2 14.2 0 0 1-4.3-.7 1 1 0 0 0-1 .3l-2 2a15.2 15.2 0 0 1-6.6-6.6l2-2a1 1 0 0 0 .2-1 14.2 14.2 0 0 1-.7-4.3A1 1 0 0 0 7.9 2H4.8A1 1 0 0 0 3.8 3C3.8 14 12 22.2 23 22.2a1 1 0 0 0 1-1v-3.1a1 1 0 0 0-.6-1.6Z" />
    ),
  },
  {
    title: "Adresa",
    value: [
      "Prevádzka BA: Bojnická 3 83104 Bratislava",
      "Prevádzka KE: Rozvojová 2, 040 11 Košice (osobný odber)",
    ],
    icon: (
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    ),
  },
  {
    title: "E-mail",
    value: "info@printexpert.sk",
    icon: (
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2.2-.5 6.8 5 6.8-5H5.2Zm13.3 2.2-4.9 3.6 4.9 3.8V8.2Zm-13 0v7.4l4.9-3.8-4.9-3.6Zm6.5 5.1L5.2 18h13.6l-6.8-4.7Z" />
    ),
  },
]

export default function ContactPage() {
  return (
    <div className="space-y-16">
      <section className="rounded-2xl border bg-muted/40 px-6 py-12 text-center">
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
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Kontaktujte nás
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Radi vám pomôžeme s výberom materiálov, cenovou ponukou aj realizáciou.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {contactBlocks.map((block) => (
            <div
              key={block.title}
              className="rounded-xl border bg-background p-6"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 fill-current"
                >
                  {block.icon}
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide">
                {block.title}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {Array.isArray(block.value) ? (
                  block.value.map((line) => <p key={line}>{line}</p>)
                ) : (
                  <p>{block.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">Náš tím</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Priamy kontakt na našich špecialistov.
            </p>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            Po–Pi 08:00–17:00
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((person) => (
            <div key={person.name} className="rounded-xl border p-5 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                {person.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide">
                {person.name}
              </h3>
              <p className="mt-1 text-xs uppercase text-primary">{person.role}</p>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>{person.phone}</p>
                <p>{person.email}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Napíšte nám</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ozveme sa vám do 24 hodín počas pracovných dní.
          </p>
          <ContactForm />
        </div>
        <div className="rounded-xl border bg-muted/40 p-6">
          <h2 className="text-xl font-semibold">Kde nás nájdete</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rozvojová 2, 040 11 Košice (osobný odber)
          </p>
          <div className="mt-6 flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-background text-sm text-muted-foreground">
            Mapový náhľad
          </div>
        </div>
      </section>
    </div>
  )
}
