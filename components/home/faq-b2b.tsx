import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqItems = [
  {
    question: "Viete vystaviť faktúru na firmu (IČO/DIČ/IČ DPH)?",
    answer:
      "Áno. Pri objednávke zadáte firemné údaje a automaticky vystavíme faktúru.",
  },
  {
    question: "Ponúkate platbu na faktúru so splatnosťou?",
    answer:
      "Pre overených B2B partnerov je možné dohodnúť platbu na faktúru so splatnosťou. Pre prvé objednávky štandardne platba vopred.",
  },
  {
    question: "Viete pripraviť individuálnu cenovú ponuku alebo cenník?",
    answer:
      "Áno. Pre pravidelných odberateľov pripravíme individuálne ceny a množstevné rabaty podľa sortimentu a objemov.",
  },
  {
    question: "Ako rýchlo viete vyrobiť zákazku?",
    answer:
      "Expresná výroba je možná (často už do 24 hodín od schválenia podkladov), závisí od materiálu, objemu a aktuálnej kapacity.",
  },
  {
    question: "Čo znamená “Prepress podpora v cene”?",
    answer:
      "Skontrolujeme podklady a pomôžeme s prípravou: spadávky, rozlíšenie, farby, bezpečné zóny, prípadne výrez/orez. Ak treba, upozorníme na riziká ešte pred tlačou.",
  },
  {
    question: "Tlačíte podľa CMYK? Viete garantovať farby?",
    answer:
      "Tlačíme v CMYK. Farby sa môžu mierne líšiť podľa materiálu a povrchovej úpravy, no pri dotlačiach držíme čo najvyššiu konzistenciu. Pri kritických farbách odporúčame dohodnúť postup (napr. vzorku/náhľad).",
  },
  {
    question: "Kedy je zákazka “schválená” a ide do výroby?",
    answer:
      "Po odsúhlasení náhľadu/podkladov (podľa typu produktu) a splnení podmienok objednávky prechádza zákazka do výroby. Po štarte výroby už zmeny nemusia byť možné.",
  },
  {
    question: "Viete dodať na viac adries alebo priamo na montáž?",
    answer:
      "Áno. Vieme doručiť na pobočky, na stavbu alebo na viac adries – logistiku nastavíme podľa dohody.",
  },
  {
    question: "Archivujete podklady pre opakované objednávky?",
    answer:
      "Áno. Podklady a nastavenia objednávky archivujeme, takže ďalšia dotlač je rýchla bez opätovného nahrávania.",
  },
  {
    question: "Ako riešite reklamácie?",
    answer:
      "Reklamáciu riešime rýchlo a férovo. Ak vznikne chyba na našej strane, navrhneme okamžité riešenie (dotlač/oprava). Pri podkladoch od klienta vždy vopred upozorňujeme na riziká.",
  },
]

export function FaqB2B() {
  return (
    <section className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Často kladené otázky (B2B)</h2>
      </div>

      <Accordion type="single" collapsible className="grid w-full gap-4 md:grid-cols-2 lg:gap-6">
        {faqItems.map((item, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="rounded-lg border bg-card px-6"
          >
            <AccordionTrigger className="text-left font-medium hover:no-underline [&[data-state=open]]:text-primary">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
