import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buildStaticPageMetadata } from "@/lib/seo"

export const metadata = buildStaticPageMetadata("doprava")

export default function DopravaPage() {
  return (
    <div className="container space-y-16 min-h-[80vh]">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Domov</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Doprava</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
        <h1 className="mt-4 text-4xl font-bold md:text-5xl">Možnosti dopravy</h1>
        <div className="mb-4">
        <p>
            Tovar môžete prebrať osobne na adrese: <span className="font-bold">Rozvojová 2, Košice 040 11</span>
        </p>

        <p>Tovar Vám doručíme kuriérskou službou <span className="font-bold">DPD</span>.</p>

</div>
        
    </div>
  )
}   
