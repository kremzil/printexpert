"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderData } from "@/types/order";

interface OrderDetailProps {
  order: OrderData;
}

const statusMap = {
  PENDING: { label: "Čaká sa", variant: "secondary" as const },
  CONFIRMED: { label: "Potvrdená", variant: "default" as const },
  PROCESSING: { label: "Spracováva sa", variant: "default" as const },
  COMPLETED: { label: "Dokončená", variant: "default" as const },
  CANCELLED: { label: "Zrušená", variant: "destructive" as const },
};

export function OrderDetail({ order }: OrderDetailProps) {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const status = statusMap[order.status];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Objednávka #{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <Badge variant={status.variant} className="text-base px-4 py-1">
          {status.label}
        </Badge>
      </div>

      {isSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Vaša objednávka bola úspešne vytvorená. Na váš email sme odoslali potvrdenie.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Položky objednávky</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      {(item.width || item.height) && (
                        <p className="text-sm text-muted-foreground">
                          Rozmery: {item.width} × {item.height} cm
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Množstvo: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(Number(item.priceGross) * item.quantity)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(Number(item.priceGross))} / ks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontaktné údaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Meno: </span>
                <span>{order.customerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">E-mail: </span>
                <span>{order.customerEmail}</span>
              </div>
              {order.customerPhone && (
                <div>
                  <span className="text-muted-foreground">Telefón: </span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              {order.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Poznámka: </span>
                  <p className="mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Súhrn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medzisoučet</span>
                  <span>{formatPrice(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DPH</span>
                  <span>{formatPrice(Number(order.vatAmount))}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-base">
                  <span>Celkom</span>
                  <span>{formatPrice(Number(order.total))}</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Režim: <span className="uppercase">{order.audience}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na objednávky
          </Link>
        </Button>
      </div>
    </div>
  );
}
