"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, ChevronRight, Download, Home, Minus, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { CartData } from "@/types/cart";
import type { CustomerMode } from "@/components/print/types";

interface CartContentProps {
  cart: CartData;
  mode: CustomerMode;
}

type PendingOrderUpload = {
  file: File;
};

declare global {
  interface Window {
    __pendingOrderUpload?: PendingOrderUpload;
  }
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

export function CartContent({ cart: initialCart, mode }: CartContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [pendingUpload, setPendingUpload] = useState<PendingOrderUpload | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingPreviewName, setPendingPreviewName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedShipping, setSelectedShipping] = useState<"courier" | "pickup">("courier");


  useEffect(() => {
    if (typeof window !== "undefined") {
      setPendingUpload(window.__pendingOrderUpload ?? null);
    }
  }, []);

  useEffect(() => {
    if (!pendingUpload?.file) {
      setPendingPreviewUrl(null);
      setPendingPreviewName(null);
      return;
    }

    const file = pendingUpload.file;
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      setPendingPreviewUrl(null);
      setPendingPreviewName(file.name);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPendingPreviewUrl(objectUrl);
    setPendingPreviewName(file.name);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingUpload]);

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

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const handleRemovePendingUpload = () => {
    if (typeof window !== "undefined") {
      delete window.__pendingOrderUpload;
    }
    setPendingUpload(null);
    setPendingPreviewUrl(null);
    setPendingPreviewName(null);
  };

  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
      <div className="container mx-auto px-4 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Košík</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Váš košík</h1>
            <p className="text-muted-foreground">
              {initialCart.items.length}{" "}
              {initialCart.items.length === 1
                ? "položka"
                : initialCart.items.length < 5
                  ? "položky"
                  : "položiek"}{" "}
              v košíku
            </p>
          </div>

          {mode === "b2b" ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:bg-muted"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Uložiť košík</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          ) : null}
        </div>

        {pendingUpload?.file ? (
          <div className="mb-6 rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
              <div className="flex-1">
                <div className="mb-1 font-semibold text-orange-900">
                  Súbor je pripravený na priloženie
                </div>
                <p className="text-sm text-orange-700">
                  Priložený súbor bude odoslaný pri dokončení objednávky.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {initialCart.items.map((item, index) => {
              const isUpdating = updatingItems.has(item.id);
              const itemPrice = item.priceSnapshot?.gross || 0;
              const itemTotal = itemPrice * item.quantity;
              const attributes = getSelectedOptionAttributes(item.selectedOptions);

              return (
                <Card key={item.id} className="p-5">
                  <div className="flex flex-col gap-5 md:flex-row">
                    <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted md:h-32 md:w-40">
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.images[0].alt || item.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Bez obrázka
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <Link
                            href={`/product/${item.product.slug}`}
                            className="text-lg font-semibold hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          {(item.width || item.height) && (
                            <div className="text-sm text-muted-foreground">
                              Rozmery: {item.width} × {item.height} cm
                            </div>
                          )}
                          {attributes && Object.keys(attributes).length > 0 ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {Object.entries(attributes).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {pendingUpload?.file && index === 0 ? (
                            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                              <div className="flex items-center justify-between gap-2">
                                <span>Priložený súbor</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRemovePendingUpload}
                                  className="h-6 px-2 text-destructive hover:text-destructive"
                                >
                                  Odstrániť
                                </Button>
                              </div>
                              <div className="mt-1 flex items-center gap-3">
                                {pendingPreviewUrl ? (
                                  <Image
                                    src={pendingPreviewUrl}
                                    alt={pendingPreviewName ?? "Náhľad"}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-md border object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-[10px] uppercase">
                                    Súbor
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  {pendingUpload.file.name} · {formatBytes(pendingUpload.file.size)}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {formatPrice(itemTotal)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPrice(itemPrice)} / ks
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4">
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
                            className="h-8 w-20 text-center"
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
                          <Trash2 className="mr-1 h-4 w-4" />
                          Odstrániť
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {mode === "b2b" ? (
              <Card className="p-4">
                <label className="mb-2 block text-sm font-medium">
                  Poznámka k objednávke (voliteľné)
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Pridajte poznámku pre váš tím alebo tlačiareň..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20 p-6">
              <h2 className="mb-4 text-lg font-semibold">Súhrn objednávky</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medzisúčet</span>
                  <span>{formatPrice(initialCart.totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DPH</span>
                  <span>{formatPrice(initialCart.totals.vatAmount)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
                  <span>Celkom</span>
                  <span>{formatPrice(initialCart.totals.total)}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium">Doprava</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={selectedShipping === "courier"}
                    onChange={() => setSelectedShipping("courier")}
                  />
                  Kuriér (vypočíta sa v pokladni)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={selectedShipping === "pickup"}
                    onChange={() => setSelectedShipping("pickup")}
                  />
                  Osobný odber (vypočíta sa v pokladni)
                </label>
              </div>

              <div className="mt-6 space-y-3">
                <Button asChild className="w-full" size="lg" disabled={isPending}>
                  <Link href="/checkout">Pokračovať k pokladni</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/catalog">Pokračovať v nákupe</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {["Kontrola súborov zadarmo", "Bezpečná platba", "Expresné dodanie"].map(
            (item) => (
              <Card key={item} className="p-6 text-center">
                <div className="mb-3 flex justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="mb-2 font-semibold">{item}</h3>
                <p className="text-sm text-muted-foreground">
                  {item === "Kontrola súborov zadarmo"
                    ? "Každý súbor prejde kontrolou pred tlačou"
                    : item === "Bezpečná platba"
                      ? "SSL šifrovanie a overené platobné brány"
                      : "Výroba do 2-3 dní + doprava"}
                </p>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
