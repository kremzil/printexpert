"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import type { CartData } from "@/types/cart";

interface CheckoutFormProps {
  cart: CartData;
}

export function CheckoutForm({ cart }: CheckoutFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get("customerName") as string,
      customerEmail: formData.get("customerEmail") as string,
      customerPhone: formData.get("customerPhone") as string,
      notes: formData.get("notes") as string,
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Chyba pri vytváraní objednávky");
      }

      const order = await response.json();
      
      // Обновляем badge корзины в хедере
      window.dispatchEvent(new Event("cart-updated"));
      
      router.push(`/account/orders/${order.id}?success=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznáma chyba");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Kontaktné údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customerName">
                Meno a priezvisko <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                name="customerName"
                required
                placeholder="Ján Novák"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="customerEmail">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                placeholder="jan.novak@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="customerPhone">Telefón</Label>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                placeholder="+421 XXX XXX XXX"
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Poznámka k objednávke</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Doplňujúce informácie k objednávke..."
              rows={4}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle>Súhrn objednávky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.items.map((item) => {
                const itemPrice = item.priceSnapshot?.gross || 0;
                const itemTotal = itemPrice * item.quantity;
                return (
                  <div key={item.id} className="space-y-1 pb-2 border-b last:border-0 last:pb-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span>{formatPrice(itemTotal)}</span>
                    </div>
                    {item.selectedOptions && 
                     typeof item.selectedOptions === 'object' && 
                     '_attributes' in item.selectedOptions && 
                     item.selectedOptions._attributes &&
                     typeof item.selectedOptions._attributes === 'object' &&
                     Object.keys(item.selectedOptions._attributes).length > 0 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        {Object.entries(item.selectedOptions._attributes as Record<string, string>).map(([key, value]) => (
                          <div key={key}>{key}: {value}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medzisoučet</span>
                <span>{formatPrice(cart.totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH</span>
                <span>{formatPrice(cart.totals.vatAmount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Celkom</span>
                <span>{formatPrice(cart.totals.total)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dokončiť objednávku
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
