import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SearchParams = {
  orderId?: string;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const orderId = resolvedSearchParams?.orderId;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Platba bola úspešná</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ďakujeme! Potvrdenie o platbe vám príde e-mailom.
          </p>
          {orderId && (
            <p className="text-sm">
              Referencia objednávky: <span className="font-medium">{orderId}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/account/orders">Prejsť na objednávky</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Pokračovať v nákupe</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
