import Link from "next/link"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { resolveAudienceContext } from "@/lib/audience-context"

type HomePageProps = {
  searchParams?: Promise<{
    mode?: string
  }>
}

async function HomeContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: HomePageProps["searchParams"]
}) {
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const isFirstVisit = audienceContext.source === "default"
  const isB2B = audienceContext.audience === "b2b"

  if (isFirstVisit) {
    return (
      <section className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Vitajte v PrintExpert</h1>
          <p className="text-muted-foreground">
            Najprv si zvoľte režim, aby sme vám ukázali správny obsah.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Som súkromná osoba</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Jednoduchá objednávka, rýchla kalkulácia a hotové produkty.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link href="/?mode=b2c">Pokračovať ako súkromná osoba</Link>
            </Button>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Som z firmy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Individuálny prístup, cenové ponuky a podpora pre firmy.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/?mode=b2b">Pokračovať ako firma</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">
          {isB2B ? "Tlačové riešenia pre firmy" : "Tlač pre každý deň"}
        </h1>
        <p className="text-muted-foreground">
          {isB2B
            ? "Pomôžeme vám s veľkoobjemovou tlačou, brandingom aj výrobou na mieru."
            : "Vyberte si z rýchlych tlačových služieb pre domácnosť aj školu."}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="sm:w-auto">
          <Link href="/catalog">Prejsť do katalógu</Link>
        </Button>
        <Button asChild variant="outline" className="sm:w-auto">
          <Link href="/kontaktujte-nas">
            {isB2B ? "Požiadať o ponuku" : "Kontaktujte nás"}
          </Link>
        </Button>
      </div>
    </section>
  )
}

export default function Page({ searchParams }: HomePageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-3">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </section>
      }
    >
      <HomeContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}
