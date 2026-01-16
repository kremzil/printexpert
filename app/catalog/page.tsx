import Link from "next/link";

import { products } from "@/data/products";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function CatalogPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Breadcrumb className="w-fit text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Domov</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Katalóg</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-semibold">Katalóg</h1>
        <p className="text-muted-foreground">
          Testovacie produkty. Neskôr nahradíme reálnymi dátami.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/product/${product.slug}`}
            className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="mb-3 aspect-[4/3] w-full rounded-md bg-muted" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">{product.title}</h2>
              <span className="text-sm text-muted-foreground">
                ${product.price}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
