"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Edit,
  FileCheck,
  Home,
  Info,
  MessageSquare,
  Minus,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ModeButton } from "@/components/print/mode-button";
import { PriceDisplay } from "@/components/print/price-display";
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
  const [note, setNote] = useState("");
  const [selectedShipping, setSelectedShipping] = useState<"courier" | "pickup">("courier");
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)";
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)";
  const subtotal = initialCart.totals.subtotal;
  const shippingCost = selectedShipping === "pickup" || subtotal >= 100 ? 0 : 4.99;
  const vatRate = 0.2;
  const totalWithVAT = initialCart.totals.total + shippingCost;
  const vatAmount = initialCart.totals.vatAmount + shippingCost * vatRate;
  const totalWithoutVAT = totalWithVAT - vatAmount;


  useEffect(() => {
    if (typeof window !== "undefined") {
      setPendingUpload(window.__pendingOrderUpload ?? null);
    }
  }, []);

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
    <div className="w-full">
      <div className="container-main py-6">
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
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md"
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.images[0].alt || item.product.name}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Bez obrázka
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            href={`/product/${item.product.slug}`}
                            className="mb-1 block font-semibold hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          {(item.width || item.height) && (
                            <div className="text-xs text-muted-foreground">
                              Rozmery: {item.width} × {item.height} cm
                            </div>
                          )}
                          {attributes && Object.keys(attributes).length > 0 ? (
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {Object.entries(attributes).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <div className="mb-1">
                            <PriceDisplay price={itemTotal} mode={mode} size="lg" />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <PriceDisplay price={itemPrice} mode={mode} size="sm" /> / ks
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        {pendingUpload?.file && index === 0 ? (
                          <div className="flex items-center gap-2 text-xs text-green-600">
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>Súbor: {pendingUpload.file.name}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => router.push(`/product/${item.product.slug}`)}
                            className="flex items-center gap-2 text-xs font-medium transition-colors hover:underline"
                            style={{ color: modeColor }}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Nahrať súbor</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isUpdating || item.quantity <= 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-medium">{item.quantity}</span>
                            <span className="text-muted-foreground">ks</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={isUpdating}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/product/${item.product.slug}`)}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-muted"
                            style={{ color: modeColor }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Upraviť</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Odstrániť</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
            <div className="sticky top-20 space-y-4">
              <Card className="p-4">
                <h3 className="mb-3 font-semibold">Spôsob doručenia</h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedShipping("courier")}
                    className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                      selectedShipping === "courier"
                        ? "shadow-sm"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{
                      borderColor:
                        selectedShipping === "courier" ? modeColor : undefined,
                      backgroundColor:
                        selectedShipping === "courier" ? modeAccent : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Truck
                          className="h-5 w-5"
                          style={{
                            color:
                              selectedShipping === "courier" ? modeColor : undefined,
                          }}
                        />
                        <div>
                          <div className="font-medium">Kuriér</div>
                          <div className="text-xs text-muted-foreground">
                            Doručenie do 1-2 dní
                          </div>
                        </div>
                      </div>
                      <div className="font-medium">
                        {shippingCost > 0 ? (
                          formatPrice(shippingCost)
                        ) : (
                          <span className="text-green-600">Zdarma</span>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedShipping("pickup")}
                    className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                      selectedShipping === "pickup"
                        ? "shadow-sm"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{
                      borderColor:
                        selectedShipping === "pickup" ? modeColor : undefined,
                      backgroundColor:
                        selectedShipping === "pickup" ? modeAccent : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart
                          className="h-5 w-5"
                          style={{
                            color:
                              selectedShipping === "pickup" ? modeColor : undefined,
                          }}
                        />
                        <div>
                          <div className="font-medium">Osobný odber</div>
                          <div className="text-xs text-muted-foreground">
                            Bratislava - zadarmo
                          </div>
                        </div>
                      </div>
                      <div className="font-medium text-green-600">Zdarma</div>
                    </div>
                  </button>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="mb-4 font-semibold">Súhrn objednávky</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Medzisúčet:</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doprava:</span>
                    {selectedShipping === "pickup" || shippingCost === 0 ? (
                      <span className="font-medium text-green-600">Zdarma</span>
                    ) : (
                      <span>{formatPrice(shippingCost)}</span>
                    )}
                  </div>

                  {mode === "b2c" ? (
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between font-semibold">
                        <span>Celkom s DPH:</span>
                        <span>{formatPrice(totalWithVAT)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Obsahuje DPH {(vatRate * 100).toFixed(0)}%:{" "}
                        {formatPrice(vatAmount)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="border-t border-border pt-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Celkom bez DPH:
                          </span>
                          <span>{formatPrice(totalWithoutVAT)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          DPH {(vatRate * 100).toFixed(0)}%:
                        </span>
                        <span className="font-medium">+{formatPrice(vatAmount)}</span>
                      </div>
                      <div className="border-t border-border pt-3">
                        <div className="flex justify-between font-semibold">
                          <span>Celkom s DPH:</span>
                          <span>{formatPrice(totalWithVAT)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div
                  className="mt-4 flex items-center gap-2 rounded-lg p-3"
                  style={{ backgroundColor: modeAccent }}
                >
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: modeColor }} />
                  <div className="text-xs">
                    <span className="font-medium" style={{ color: modeColor }}>
                      Odhadovaná výroba:
                    </span>
                    <span className="ml-1 text-muted-foreground">3-4 pracovné dni</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <ModeButton
                    mode={mode}
                    variant="primary"
                    size="lg"
                    onClick={() => router.push("/checkout")}
                    className="w-full"
                    disabled={isPending}
                  >
                    {mode === "b2c" ? "Pokračovať k platbe" : "Pokračovať k objednávke"}
                  </ModeButton>
                  {mode === "b2b" ? (
                    <ModeButton
                      mode={mode}
                      variant="outline"
                      size="md"
                      onClick={() => router.push("/checkout")}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Požiadať o cenovú ponuku
                    </ModeButton>
                  ) : null}
                  <ModeButton
                    mode={mode}
                    variant="outline"
                    size="md"
                    onClick={() => router.push("/catalog")}
                    className="w-full"
                  >
                    Pokračovať v nákupe
                  </ModeButton>
                </div>

                {mode === "b2b" ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="text-muted-foreground">
                      Pri objednávke nad 500 € kontaktujeme vás pre overenie detailov
                      a možné ďalšie zľavy.
                    </div>
                  </div>
                ) : null}
              </Card>

              {mode === "b2c" && subtotal < 100 && selectedShipping === "courier" ? (
                <div className="rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 p-4 text-center">
                  <div className="text-sm font-medium text-orange-900">
                    Pridajte ešte {formatPrice(100 - subtotal)}{" "}
                    <span className="ml-1">a získate dopravu zadarmo! 🎉</span>
                  </div>
                </div>
              ) : null}
            </div>
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
