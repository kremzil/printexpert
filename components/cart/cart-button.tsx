"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Trash2 } from "lucide-react";
import { ModeButton } from "@/components/print/mode-button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getCsrfHeader } from "@/lib/csrf";
import type { CartData } from "@/types/cart";
import type { CustomerMode } from "@/components/print/types";

type CartButtonProps = {
  mode?: CustomerMode;
};

type CartResponse = CartData & { id: string | null };

export function CartButton({ mode = "b2c" }: CartButtonProps) {
  const [itemCount, setItemCount] = useState(0);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/cart");
        if (response.ok) {
          const cartData = (await response.json()) as CartResponse;
          const count = cartData.items?.length || 0;
          setItemCount(count);
          setCart(cartData);
        }
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCart();

    // Обновляем при изменении корзины
    const handleCartUpdate = () => fetchCart();
    window.addEventListener("cart-updated", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCart = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/cart");
        if (response.ok) {
          const cartData = (await response.json()) as CartResponse;
          const count = cartData.items?.length || 0;
          setItemCount(count);
          setCart(cartData);
        }
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCart();
  }, [isOpen]);

  const items = cart?.items ?? [];
  const subtotal = cart?.totals.subtotal ?? 0;
  const vatAmount = cart?.totals.vatAmount ?? 0;
  const total = cart?.totals.total ?? 0;
  const totalWithoutVat = Math.max(total - vatAmount, 0);
  const normalizedVatRate = subtotal > 0 ? vatAmount / subtotal : 0.2;
  const vatPercent = Math.round(normalizedVatRate * 100);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(price);

  const handleRemove = async (itemId: string) => {
    setRemovingItems((prev) => new Set(prev).add(itemId));
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      });

      if (!response.ok) throw new Error("Chyba pri odstraňovaní");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (error) {
      console.error("Remove error:", error);
    } finally {
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <ModeButton mode={mode} asChild variant="ghost" size="icon" className="relative">
          <button type="button" aria-label="Nákupný košík">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {itemCount > 9 ? "9+" : itemCount}
              </Badge>
            )}
          </button>
        </ModeButton>
      </SheetTrigger>
      <SheetContent side="right" className="w-[92vw] sm:w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Košík</SheetTitle>
          <SheetDescription>Skontrolujte položky pred pokračovaním.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col gap-4 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Načítavam košík...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="text-sm text-muted-foreground">
                Váš košík je prázdny.
              </div>
              <SheetClose asChild>
                <ModeButton mode={mode} asChild variant="outline" size="sm">
                  <Link href="/catalog">Prejsť do katalógu</Link>
                </ModeButton>
              </SheetClose>
            </div>
          ) : (
            <>
              <div className="max-h-[45vh] overflow-y-auto pr-2">
                <ul className="space-y-3">
                  {items.map((item) => {
                    const itemPrice = item.priceSnapshot?.gross ?? 0;
                    const itemTotal = itemPrice * item.quantity;
                    const image = item.product.images[0];
                    const isRemoving = removingItems.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-border/60 p-1"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                            {image ? (
                              <Image
                                src={image.url}
                                alt={image.alt || item.product.name}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                Bez obrázka
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/product/${item.product.slug}`}
                              className="line-clamp-2 text-sm font-medium hover:underline"
                            >
                              {item.product.name}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Množstvo: {item.quantity} ks
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-right text-sm font-semibold">
                              {formatPrice(itemTotal)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemove(item.id)}
                              disabled={isRemoving}
                              aria-label="Odstrániť položku"
                              className="rounded-md border border-border/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-30 border-t border-gray-900 pt-4 space-y-3 px-2">
                {mode === "b2c" ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Medzisúčet</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Celkom s DPH</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Obsahuje DPH {vatPercent}%: {formatPrice(vatAmount)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Medzisúčet</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Celkom bez DPH</span>
                      <span>{formatPrice(totalWithoutVat)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      bez DPH (+ {formatPrice(vatAmount)} DPH = {formatPrice(total)})
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>DPH {vatPercent}%</span>
                      <span>+{formatPrice(vatAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Celkom s DPH</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </>
                )}
                <div className="grid gap-2 mt-6">
                  <SheetClose asChild>
                    <ModeButton mode={mode} asChild variant="outline" className="w-full">
                      <Link href="/cart">Zobraziť košík</Link>
                    </ModeButton>
                  </SheetClose>
                  <SheetClose asChild>
                    <ModeButton mode={mode} asChild variant="primary" className="w-full">
                      <Link href="/checkout">
                        {mode === "b2c" ? "Pokračovať k platbe" : "Pokračovať k objednávke"}
                      </Link>
                    </ModeButton>
                  </SheetClose>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
