import { 
  UserCheck, 
  CalendarCheck, 
  Percent, 
  FileCheck, 
  Award, 
  History 
} from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const features = [
  {
    title: "Osobný B2B manažér",
    description:
      "Jeden kontakt, rýchla komunikácia, jasná zodpovednosť od kalkulácie po doručenie.",
    icon: UserCheck,
  },
  {
    title: "Garantované termíny (SLA)",
    description:
      "Pracujeme s potvrdením výroby a dodania – aby ste stihli montáž, event alebo kampaň.",
    icon: CalendarCheck,
  },
  {
    title: "Individuálne ceny",
    description:
      "Nastavíme výhodné ceny pre agentúry, firmy a resellerov podľa objemov.",
    icon: Percent,
  },
  {
    title: "Prepress podpora v cene",
    description:
      "Kontrola + pomoc s prípravou podkladov (spadávky, farby, rozlíšenie, bezpečné zóny).",
    icon: FileCheck,
  },
  {
    title: "Stabilná kvalita",
    description:
      "Opakovateľné výsledky pri dotlačiach a dlhodobých kampaniach pre značky.",
    icon: Award,
  },
  {
    title: "Rýchle doobjednanie",
    description:
      "Archivujeme podklady aj nastavenia – ďalšia objednávka je otázka minút.",
    icon: History,
  },
]

export function WhyChooseUsB2B() {
  return (
    <section className="space-y-8">
      <div className="space-y-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Prečo si vybrať práve nás (B2B)</h2>
        <p className="mx-auto text-muted-foreground max-w-3xl">
          Partner pre vaše podnikanie s dôrazom na spoľahlivosť a kvalitu.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-border/40 bg-card/50 transition-colors hover:bg-card">
            <CardHeader>
              <feature.icon className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription className="text-sm">
                {feature.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}
