"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Briefcase,
  Clock,
  FileText,
  Headphones,
  Shield,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react"

import { ModeSelectionCard } from "@/components/print/mode-selection-card"
import type { CustomerMode } from "@/components/print/types"

export function ModeSelectionPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const b2cFeatures = [
    "Online konfigurátor produktov",
    "Expresné dodanie do 24 hodín",
    "Ceny s DPH hneď viditeľné",
    "Jednoduché a rýchle objednávanie",
    "Kontrola súborov v cene",
    "Osobný odber alebo kuriér",
  ]

  const b2bFeatures = [
    "Osobný account manažér",
    "Objemové zľavy až -45%",
    "Ceny bez DPH + fakturácia",
    "Cenové ponuky na mieru",
    "Archivácia podkladov",
    "Flexibilná logistika a splatnosť",
  ]


  const handleModeSelected = (mode: CustomerMode) => {
    if (isPending) return

    startTransition(async () => {
      try {
        const response = await fetch("/api/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        })

        if (!response.ok) {
          return
        }

        router.refresh()
      } catch (error) {
        console.error("Mode selection error:", error)
      }
    })
  }

  return (
    <div className="w-full">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="container-main py-12 md:py-20">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Vitajte na Printexpert.sk
            </div>

            <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              Vyberte si režim
              <br />
              <span className="bg-gradient-to-r from-red-600 via-orange-600 to-blue-600 bg-clip-text text-transparent">
                pre vaše potreby
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
              Či už ste individuálny zákazník alebo firma, máme pre vás
              optimalizované riešenie s príslušnými výhodami a službami.
            </p>
          </div>

          <div className="mx-auto mb-12 grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">Vyberte B2C ak:</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Nakupujete ako súkromná osoba</li>
                <li>• Potrebujete menšie množstvá</li>
                <li>• Chcete rýchle a jednoduché objednanie</li>
                <li>• Uprednostňujete online platbu</li>
              </ul>
            </div>

            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">Vyberte B2B ak:</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Nakupujete ako firma alebo živnostník</li>
                <li>• Potrebujete väčšie objemy</li>
                <li>• Chcete osobnú podporu a poradenstvo</li>
                <li>• Potrebujete faktúry a odloženú platbu</li>
              </ul>
            </div>
          </div>

          <div className="mx-auto mb-12 grid max-w-6xl gap-8 lg:grid-cols-2">
            <ModeSelectionCard
              mode="b2c"
              title="B2C Režim"
              subtitle="Pre individuálnych zákazníkov"
              description="Rýchle a jednoduché objednávanie s expresným dodaním. Ideálne pre súkromné osoby a menšie objemy."
              features={b2cFeatures}
              icon={ShoppingBag}
              image="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80"
              onSelect={() => handleModeSelected("b2c")}
              isPending={isPending}
            />

            <ModeSelectionCard
              mode="b2b"
              title="B2B Režim"
              subtitle="Pre firmy a živnostníkov"
              description="Profesionálne služby s osobným prístupom. Objemové zľavy, fakturácia a flexibilná logistika."
              features={b2bFeatures}
              icon={Briefcase}
              image="https://images.unsplash.com/photo-1664575602276-acd073f104c1?w=800&q=80"
              onSelect={() => handleModeSelected("b2b")}
              isPending={isPending}
            />
          </div>


          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-2xl font-bold md:text-3xl">
                Výhody pre všetkých
              </h2>
              <p className="text-muted-foreground">
                Bez ohľadu na zvolený režim získate prémiovú kvalitu
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                    <Clock className="h-7 w-7 text-green-600" />
                  </div>
                </div>
                <h3 className="mb-2 font-semibold">Expresná výroba</h3>
                <p className="text-sm text-muted-foreground">
                  Dodanie do 24-48 hodín pri štandardných produktoch
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                    <Shield className="h-7 w-7 text-blue-600" />
                  </div>
                </div>
                <h3 className="mb-2 font-semibold">Prémiová kvalita</h3>
                <p className="text-sm text-muted-foreground">
                  ISO 9001 certifikácia a kontrola každého produktu
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100">
                    <FileText className="h-7 w-7 text-purple-600" />
                  </div>
                </div>
                <h3 className="mb-2 font-semibold">Kontrola súborov</h3>
                <p className="text-sm text-muted-foreground">
                  Profesionálna kontrola podkladov v cene
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
                    <Headphones className="h-7 w-7 text-orange-600" />
                  </div>
                </div>
                <h3 className="mb-2 font-semibold">Podpora 24/7</h3>
                <p className="text-sm text-muted-foreground">
                  Online chat a emailová podpora kedykoľvek
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-3 text-2xl font-bold">
              Dôveruje nám viac ako 15 000 zákazníkov
            </h3>
            <p className="mb-6 text-muted-foreground">
              Vrátane 500+ firemných klientov z celého Slovenska
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-sm">
              <div>
                <div className="text-2xl font-bold text-primary">4.9★</div>
                <div className="text-muted-foreground">Hodnotenie</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">98%</div>
                <div className="text-muted-foreground">Spokojnosť</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">2-3 dni</div>
                <div className="text-muted-foreground">Priemerná výroba</div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>Režim môžete kedykoľvek zmeniť v nastaveniach vášho účtu.</p>
            <p className="mt-1">
              Neviete sa rozhodnúť? Kontaktujte nás na{" "}
              <a
                href="mailto:info@printexpert.sk"
                className="font-medium text-primary hover:underline"
              >
                info@printexpert.sk
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
