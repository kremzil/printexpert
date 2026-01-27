import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqItems = [
  {
    question: "Ako vytvorím objednávku?",
    answer:
      "Vyberte si produkt v katalógu, nakonfigurujte parametre (rozmer, papier), nahrajte svoje súbory a vložte do košíka.",
  },
  {
    question: "Môžem platiť kartou online?",
    answer:
      "Áno, podporujeme bezpečné platby kartou cez platobnú bránu. Taktiež je možný prevod na účet.",
  },
  {
    question: "Koľko trvá výroba a dodanie?",
    answer:
      "Štandardná výroba trvá 24-48 hodín v pracovných dňoch. Kuriér doručí zásielku zvyčajne nasledujúci pracovný deň po expedícii.",
  },
  {
    question: "V akom formáte mám dodať podklady?",
    answer:
      "Ideálne je PDF, ale poradíme si aj s kvalitným JPG alebo PNG. Pri fotoproduktoch stačia bežné fotky z mobilu či fotoaparátu.",
  },
  {
    question: "Dá sa tovar vrátiť (reklamácia)?",
    answer:
      "U produktov vyrobených na mieru (s vašou fotkou/grafikou) nie je možné odstúpenie bez udania dôvodu. Ak je však chyba vo výrobe, samozrejme tovar reklamujte a my to napravíme.",
  },
  {
    question: "Čo ak nemám vlastnú grafiku?",
    answer:
      "Pre jednoduché produkty máme online editor (pripravujeme). Prípadne nás kontaktujte, vieme zabezpečiť jednoduchú grafickú prípravu.",
  },
  {
    question: "Kde si môžem tovar vyzdvihnúť?",
    answer:
      "Osobný odber je možný na našej prevádzke. Taktiež zasielame cez Packetu alebo kuriérom na vašu adresu.",
  },
  {
    question: "Dostanem faktúru?",
    answer:
      "Áno, faktúru vám pošleme elektronicky na email po vybavení objednávky. Slúži aj ako doklad o kúpe.",
  },
]

export function FaqB2C() {
  return (
    <section className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Často kladené otázky (B2C)</h2>
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
