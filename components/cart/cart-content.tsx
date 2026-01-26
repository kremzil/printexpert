"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { CartData } from "@/types/cart";

interface CartContentProps {
  cart: CartData;
}

const getSelectedOptionAttributes = (selectedOptions: unknown): Record<string, string> | null => {
  if (!selectedOptions || typeof selectedOptions !== "object") {
    return null;
  }

  if (!("_attributes" in selectedOptions)) {
    return null;
  }

  const attributes = (selectedOptions as { _attributes?: unknown })._attributes;

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  return attributes as Record<string, string>;
};

export function CartContent({ cart: initialCart }: CartContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) throw new Error("Chyba pri aktualizácii");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Update error:", error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRemove = async (itemId: string) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Chyba pri odstraňovaní");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Remove error:", error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {initialCart.items.map((item) => {
          const isUpdating = updatingItems.has(item.id);
          const itemPrice = item.priceSnapshot?.gross || 0;
          const itemTotal = itemPrice * item.quantity;

          return (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border">
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0].url}
                        alt={item.product.images[0].alt || item.product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted text-muted-foreground text-xs">
                        Bez obrázka
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between">
                      <div>
                        <Link
                          href={`/product/${item.product.slug}`}
                          className="font-medium hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        {(item.width || item.height) && (
                          <p className="text-sm text-muted-foreground">
                            Rozmery: {item.width} × {item.height} cm
                          </p>
                        )}
                        {(() => {
                          const attributes = getSelectedOptionAttributes(item.selectedOptions);

                          if (!attributes || Object.keys(attributes).length === 0) {
                            return null;
                          }

                          return (
                            <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                              {Object.entries(attributes).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(itemTotal)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(itemPrice)} / ks
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isUpdating || item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0) handleUpdateQuantity(item.id, val);
                          }}
                          className="h-8 w-16 text-center"
                          disabled={isUpdating}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isUpdating}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(item.id)}
                        disabled={isUpdating}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Odstrániť
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Súhrn objednávky</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medzisoučet</span>
                <span>{formatPrice(initialCart.totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH</span>
                <span>{formatPrice(initialCart.totals.vatAmount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Celkom</span>
                <span>{formatPrice(initialCart.totals.total)}</span>
              </div>
            </div>

            <Button asChild className="w-full" size="lg" disabled={isPending}>
              <Link href="/checkout">Pokračovať k pokladni</Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/catalog">Pokračovať v nákupe</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
