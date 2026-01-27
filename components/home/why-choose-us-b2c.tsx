import {
  MousePointerClick,
  Stamp,
  Truck,
  PiggyBank,
  Palette,
  MapPin,
} from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const features = [
  {
    title: "Jednoduchá objednávka",
    description:
      "Intuitívny proces objednávky, ktorý zvládne každý za pár minút, aj z mobilu.",
    icon: MousePointerClick,
  },
  {
    title: "Tlač už od 1 kusu",
    description:
      "Nemusíte objednávať tisíce kusov. Vyrobíme vám aj jediný kus pre radosť.",
    icon: Stamp,
  },
  {
    title: "Rýchle doručenie",
    description:
      "Väčšinu produktov expedujeme do 24-48 hodín priamo k vám domov.",
    icon: Truck,
  },
  {
    title: "Férové ceny",
    description:
      "Kvalitná tlač za ceny, ktoré nezruinujú váš rodinný rozpočet.",
    icon: PiggyBank,
  },
  {
    title: "Špičková kvalita",
    description:
      "Používame moderné digitálne stroje pre ostré detaily a živé farby.",
    icon: Palette,
  },
  {
    title: "Osobný odber / Packeta",
    description:
      "Vyzdvihnite si tovar u nás alebo v tisíckach výdajných miest po celom Slovensku.",
    icon: MapPin,
  },
]

export function WhyChooseUsB2C() {
  return (
    <section className="space-y-8">
      <div className="space-y-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Prečo nakúpiť u nás (B2C)</h2>
        <p className="mx-auto text-muted-foreground max-w-3xl">
          Sme tu pre vaše osobné projekty, darčeky aj domáce tlačoviny.
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
