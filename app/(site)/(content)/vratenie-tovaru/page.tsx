import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buildStaticPageMetadata } from "@/lib/seo"

export const metadata = buildStaticPageMetadata("vratenieTovaru")

export default function VratenieTovaruPage() {
  return (
    <div className="container space-y-16">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Domov</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Vrátenie tovaru</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
        <h1 className="mt-4 text-4xl font-bold md:text-5xl">Vrátenie tovaru</h1>
        <div className="mb-4">
        <p>
            V našom internetovom obchode nakupujete tovar, ktorý bol pre vás vyrobený na mieru. </p>

            <p>Podľa zákona č. 102/2014 Z.z. o ochrane spotrebiteľa pri predaji na diaľku, ods. §7 ods.6c <span className="font-bold">sa nevzťahuje na tovar vyrobený na mieru do 14 dní od zakúpenia.</span></p>

<p>V prípade, že máte akékoľvek otázky týkajúce sa vrátenia tovaru, neváhajte nás kontaktovať prostredníctvom našej <a href="/kontaktujte-nas" className="text-blue-500 underline">zákazníckej podpory</a>.</p>
</div>
        
    </div>
  )
}   
