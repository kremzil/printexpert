"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
  MapPin,
  MessageSquare,
  Minus,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  Paintbrush,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeButton } from "@/components/print/mode-button";
import { PriceDisplay } from "@/components/print/price-display";
import { getCsrfHeader } from "@/lib/csrf";
import {
  calculateDpdCourierShippingGross,
  normalizeFreeShippingFrom,
  normalizeCourierPrice,
} from "@/lib/delivery-pricing";
import { getDesignElementCount } from "@/lib/design-studio";
import { resolveProductImageUrl } from "@/lib/image-url";
import type { CartData } from "@/types/cart";
import type { CustomerMode } from "@/components/print/types";

interface CartContentProps {
  cart: CartData;
  mode: CustomerMode;
  vatRate: number;
  dpdCourierPrice: number;
  dpdCourierFreeFrom: number;
}

type PendingOrderUpload = {
  file: File;
  cartItemId?: string;
};

type CartDeliveryMethod = "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP";
type CartPickupPoint = {
  parcelShopId: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
};

declare global {
  type DpdPudoPlace = {
    id: string;
    name: string;
    street: string;
    houseno: string;
    zip: string;
    city: string;
    countryCode: string;
  };

  interface Window {
    __pendingOrderUpload?: PendingOrderUpload;
    DpdPudo?: {
      Widget: new (options: Record<string, unknown>) => {
        open: () => Promise<DpdPudoPlace>;
      };
    };
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

const getNextPreset = (presets: number[], current: number) => {
  for (const value of presets) {
    if (value > current) {
      return value;
    }
  }
  return current;
};

const getPrevPreset = (presets: number[], current: number) => {
  for (let i = presets.length - 1; i >= 0; i -= 1) {
    const value = presets[i];
    if (value < current) {
      return value;
    }
  }
  return current;
};

export function CartContent({
  cart: initialCart,
  mode,
  vatRate,
  dpdCourierPrice,
  dpdCourierFreeFrom,
}: CartContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [pendingUpload, setPendingUpload] = useState<PendingOrderUpload | null>(null);
  const [note, setNote] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<CartDeliveryMethod>("DPD_COURIER");
  const [pickupPoint, setPickupPoint] = useState<CartPickupPoint | null>(null);
  const [isOpeningPickupWidget, setIsOpeningPickupWidget] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [dpdWidgetConfig, setDpdWidgetConfig] = useState<{
    enabled: boolean;
    apiKey: string;
    language: string;
  }>({
    enabled: false,
    apiKey: "",
    language: "sk",
  });
  const [pickupPointEnabled, setPickupPointEnabled] = useState(true);
  const [hasHydratedDelivery, setHasHydratedDelivery] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const checkoutStorageKey = `checkout-address-v1:${mode}`;
  const isB2B = mode === "b2b";
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)";
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)";
  const subtotal = initialCart.totals.subtotal;
  const normalizedCourierFreeFrom = normalizeFreeShippingFrom(dpdCourierFreeFrom);
  const normalizedCourierPrice = normalizeCourierPrice(dpdCourierPrice);
  const courierShippingCost = calculateDpdCourierShippingGross({
    deliveryMethod: "DPD_COURIER",
    productsSubtotal: subtotal,
    courierPrice: normalizedCourierPrice,
    freeShippingFrom: normalizedCourierFreeFrom,
  });
  const pickupShippingCost = calculateDpdCourierShippingGross({
    deliveryMethod: "DPD_PICKUP",
    productsSubtotal: subtotal,
    courierPrice: normalizedCourierPrice,
    freeShippingFrom: normalizedCourierFreeFrom,
  });
  const shippingCost =
    deliveryMethod === "PERSONAL_PICKUP"
      ? 0
      : deliveryMethod === "DPD_PICKUP"
        ? pickupShippingCost
        : courierShippingCost;
  const normalizeVatRate = Number.isFinite(vatRate) && vatRate > 0 ? vatRate : 0.2;
  const totalWithVAT = initialCart.totals.total + shippingCost;
  const vatAmount = initialCart.totals.vatAmount + shippingCost * normalizeVatRate;
  const totalWithoutVAT = totalWithVAT - vatAmount;
  const hasMatrixItems = initialCart.items.some(
    (item) => item.product.priceType?.toUpperCase() === "MATRIX"
  );

  const getNetVat = (grossValue: number) => {
    const net = grossValue / (1 + normalizeVatRate);
    const vat = grossValue - net;
    return { net, vat };
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      setPendingUpload(window.__pendingOrderUpload ?? null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/shop-settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        setPickupPointEnabled(
          String(data?.dpdShipping?.pickupPointEnabled ?? "true") !== "false"
        );
        setDpdWidgetConfig({
          enabled: Boolean(data?.dpdWidget?.enabled),
          apiKey: String(data?.dpdWidget?.apiKey ?? ""),
          language: String(data?.dpdWidget?.language ?? "sk"),
        });
      } catch {
        // keep defaults
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pickupPointEnabled && deliveryMethod === "DPD_PICKUP") {
      setDeliveryMethod("DPD_COURIER");
      setPickupPoint(null);
    }
  }, [pickupPointEnabled, deliveryMethod]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(checkoutStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          selectedDeliveryMethod?: CartDeliveryMethod;
          selectedPickupPoint?: CartPickupPoint | null;
        };
        if (
          parsed?.selectedDeliveryMethod === "DPD_COURIER" ||
          parsed?.selectedDeliveryMethod === "DPD_PICKUP" ||
          parsed?.selectedDeliveryMethod === "PERSONAL_PICKUP"
        ) {
          setDeliveryMethod(parsed.selectedDeliveryMethod);
        }
        if (parsed?.selectedPickupPoint?.parcelShopId) {
          setPickupPoint(parsed.selectedPickupPoint);
        }
      }
    } catch (storageError) {
      console.warn("Cart delivery restore failed:", storageError);
    } finally {
      setHasHydratedDelivery(true);
    }
  }, [checkoutStorageKey]);

  useEffect(() => {
    if (!hasHydratedDelivery) return;
    try {
      const stored = localStorage.getItem(checkoutStorageKey);
      const payload =
        stored && stored.trim().length > 0
          ? (JSON.parse(stored) as Record<string, unknown>)
          : {};
      const nextPayload = {
        ...payload,
        selectedDeliveryMethod: deliveryMethod,
        selectedPickupPoint: deliveryMethod === "DPD_PICKUP" ? pickupPoint : null,
      };
      localStorage.setItem(checkoutStorageKey, JSON.stringify(nextPayload));
    } catch (storageError) {
      console.warn("Cart delivery persist failed:", storageError);
    }
  }, [checkoutStorageKey, deliveryMethod, hasHydratedDelivery, pickupPoint]);

  const ensureDpdWidgetLibrary = useCallback(async () => {
    if (window.DpdPudo?.Widget) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-dpd-widget="1"]'
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Widget script load failed")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://pus-maps.dpd.sk/lib/library.js";
      script.async = true;
      script.dataset.dpdWidget = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Widget script load failed"));
      document.body.appendChild(script);
    });
  }, []);

  const handleOpenPickupWidget = useCallback(async () => {
    if (!dpdWidgetConfig.enabled) {
      setDeliveryError("Widget odberných miest nie je povolený v nastaveniach.");
      return;
    }
    if (!dpdWidgetConfig.apiKey) {
      setDeliveryError("Chýba API kľúč mapy DPD.");
      return;
    }

    setIsOpeningPickupWidget(true);
    setDeliveryError(null);
    try {
      await ensureDpdWidgetLibrary();
      if (!window.DpdPudo?.Widget) {
        throw new Error("Widget sa nepodarilo inicializovať.");
      }

      const widget = new window.DpdPudo.Widget({
        apiKey: dpdWidgetConfig.apiKey,
        language: dpdWidgetConfig.language || "sk",
        allowedCountries: ["sk"],
        allowedPudoTypes: ["shop", "locker"],
        selectedPudoId: pickupPoint?.parcelShopId ?? "",
      });

      const pudo = await widget.open();
      setPickupPoint({
        parcelShopId: pudo.id,
        name: pudo.name,
        street: [pudo.street, pudo.houseno].filter(Boolean).join(" "),
        city: pudo.city,
        zip: pudo.zip,
        country: (pudo.countryCode || "sk").toUpperCase(),
      });
      setDeliveryError(null);
    } catch (widgetError) {
      const message =
        widgetError instanceof Error ? widgetError.message : String(widgetError);
      if (message === "closed_by_user") {
        return;
      }
      if (message === "invalid_api_key") {
        setDeliveryError("DPD API kľúč mapy nie je platný.");
        return;
      }
      if (message === "missing_api_key") {
        setDeliveryError("Chýba API kľúč mapy DPD.");
        return;
      }
      setDeliveryError("Nepodarilo sa otvoriť mapu odberných miest DPD.");
    } finally {
      setIsOpeningPickupWidget(false);
    }
  }, [dpdWidgetConfig, ensureDpdWidgetLibrary, pickupPoint?.parcelShopId]);

  const handleProceedToCheckout = () => {
    if (deliveryMethod === "DPD_PICKUP" && !pickupPoint?.parcelShopId) {
      setDeliveryError("Vyberte odberné miesto DPD.");
      return;
    }
    setDeliveryError(null);
    router.push("/checkout");
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) throw new Error("Chyba pri aktualizácii");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

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
        headers: { ...getCsrfHeader() },
      });

      if (!response.ok) throw new Error("Chyba pri odstraňovaní");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

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

  const handleSaveCart = async () => {
    if (!isB2B || saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/saved-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          name: saveName.trim() !== "" ? saveName.trim() : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error ?? "Nepodarilo sa uložiť košík. Skúste to znova.";
        setSaveStatus("error");
        setSaveMessage({ type: "error", text: message });
        return;
      }

      setSaveStatus("success");
      setSaveMessage({ type: "success", text: "Košík bol uložený." });
      setIsSaveDialogOpen(false);
      setSaveName("");
    } catch (error) {
      console.error("Save cart error:", error);
      setSaveStatus("error");
      setSaveMessage({ type: "error", text: "Nepodarilo sa uložiť košík. Skúste to znova." });
    }
  };

  return (
    <div className="min-h-screen bg-background rounded-2xl shadow-2xl my-4 md:my-8">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
        <nav className="mb-6 flex items-center gap-2 text-[14px] text-[#717182]">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
          <span className="text-[#0a0a0a]">Košík</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-[30px] font-bold leading-[36px] text-[#0a0a0a]">
              Váš košík
            </h1>
            <p className="text-[16px] leading-[24px] text-[#717182]">
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
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <div className="flex flex-wrap gap-2">
                <Dialog
                  open={isSaveDialogOpen}
                  onOpenChange={(open) => {
                    setIsSaveDialogOpen(open);
                    if (open) {
                      setSaveMessage(null);
                    } else {
                      setSaveName("");
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      disabled={saveStatus === "saving" || initialCart.items.length === 0}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      <span className="hidden sm:inline">Uložiť košík</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent size="default">
                    <DialogHeader>
                      <DialogTitle>Uložiť košík</DialogTitle>
                      <DialogDescription>
                        Uložte aktuálnu zostavu produktov pre rýchle opakovanie.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="saved-cart-name">Názov košíka</Label>
                      <Input
                        id="saved-cart-name"
                        placeholder="Napr. Mesačná výroba"
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Názov je voliteľný. Ak ho nevyplníte, použije sa predvolený názov.
                      </p>
                    </div>
                    {saveMessage?.type === "error" ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {saveMessage.text}
                      </div>
                    ) : null}
                    <DialogFooter>
                      <ModeButton
                        mode={mode}
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIsSaveDialogOpen(false)}
                      >
                        Zrušiť
                      </ModeButton>
                      <ModeButton
                        mode={mode}
                        variant="primary"
                        size="sm"
                        type="button"
                        onClick={handleSaveCart}
                        disabled={saveStatus === "saving" || initialCart.items.length === 0}
                      >
                        {saveStatus === "saving" ? "Ukladám..." : "Uložiť"}
                      </ModeButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <a
                  href="/api/cart/quote"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Cenová ponuka</span>
                </a>
              </div>
              {saveMessage?.type === "success" ? (
                <div className="text-sm text-green-600">
                  {saveMessage.text}{" "}
                  <Link href="/account/saved-carts" className="font-medium underline">
                    Zobraziť uložené košíky
                  </Link>
                </div>
              ) : null}
              {saveMessage?.type === "error" ? (
                <div className="text-sm text-red-600">{saveMessage.text}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {pendingUpload?.file && hasMatrixItems ? (
          <div className="mb-6 rounded-[10px] border-2 border-[#ffa2a2] bg-[#fef2f2] px-[18px] pb-[2px] pt-[18px]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#c10007]" />
              <div className="flex-1">
                <div className="mb-1 text-[16px] font-bold leading-[24px] text-[#82181a]">
                  Súbor je pripravený na priloženie
                </div>
                <p className="text-[14px] leading-[20px] text-[#c10007]">
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
              const isMatrixItem = item.product.priceType?.toUpperCase() === "MATRIX";
              const itemPrice = item.priceSnapshot?.gross || 0;
              const itemTotal = itemPrice * item.quantity;
              const attributes = getSelectedOptionAttributes(item.selectedOptions);
              const quantityPresets =
                item.quantityPresets && item.quantityPresets.length > 0
                  ? item.quantityPresets
                  : null;
              const nextQuantity = quantityPresets
                ? getNextPreset(quantityPresets, item.quantity)
                : item.quantity + 1;
              const prevQuantity = quantityPresets
                ? getPrevPreset(quantityPresets, item.quantity)
                : item.quantity - 1;
              const canDecrease = quantityPresets
                ? prevQuantity !== item.quantity
                : item.quantity > 1;
              const canIncrease = quantityPresets
                ? nextQuantity !== item.quantity
                : true;
              const primaryImage = item.product.images[0];
              const primaryImageUrl = resolveProductImageUrl(primaryImage?.url);

              return (
                <div
                  key={item.id}
                  className="rounded-[10px] border border-black/10 bg-white px-4 py-[17px]"
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[10px] border border-black/10 bg-[#ececf0]">
                      {primaryImageUrl ? (
                        <Image
                          src={primaryImageUrl}
                          alt={primaryImage?.alt || item.product.name}
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
                            className="mb-1 block text-[18px] font-bold leading-[27px] text-[#0a0a0a] hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          {(item.width || item.height) && (
                            <div className="text-[12px] leading-[16px] text-[#717182]">
                              Rozmery: {item.width} × {item.height} cm
                            </div>
                          )}
                          {attributes && Object.keys(attributes).length > 0 ? (
                            <div className="mt-1 space-y-0.5 text-[12px] leading-[16px] text-[#717182]">
                              {Object.entries(attributes).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {(() => {
                            const designElements = getDesignElementCount(item.designData);
                            if (designElements <= 0) return null;
                            return (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                              <Paintbrush className="h-3 w-3" />
                              Design Studio ({designElements} elementov)
                            </div>
                            );
                          })()}
                        </div>

                        <div className="text-right">
                          <div className="mb-1">
                            <PriceDisplay price={itemTotal} mode={mode} size="lg" vatRate={normalizeVatRate} />
                          </div>
                          <div className="text-[12px] leading-[16px] text-[#717182]">
                            <PriceDisplay price={itemPrice} mode={mode} size="sm" vatRate={normalizeVatRate} /> / ks
                          </div>
                        </div>
                      </div>

                      {isMatrixItem ? (
                        <div className="mb-3">
                          {pendingUpload?.file &&
                          (pendingUpload.cartItemId
                            ? pendingUpload.cartItemId === item.id
                            : index === 0) ? (
                            <div className="flex items-center gap-2 text-[12px] leading-[16px] text-[#00a63e]">
                              <FileCheck className="h-3.5 w-3.5" />
                              <span>Súbor: {pendingUpload.file.name}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => router.push(`/product/${item.product.slug}`)}
                              className="flex items-center gap-2 text-[12px] leading-[16px] transition-colors hover:underline"
                              style={{ color: modeColor }}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              <span>Nahrať súbor</span>
                            </button>
                          )}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (prevQuantity !== item.quantity) {
                                handleUpdateQuantity(item.id, prevQuantity);
                              }
                            }}
                            disabled={isUpdating || !canDecrease}
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/10 bg-white transition-colors hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="flex items-center gap-1 text-[14px] leading-[20px]">
                            <span className="font-medium text-[#0a0a0a]">
                              {item.quantity}
                            </span>
                            <span className="text-[#717182]">ks</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (nextQuantity !== item.quantity) {
                                handleUpdateQuantity(item.id, nextQuantity);
                              }
                            }}
                            disabled={isUpdating || !canIncrease}
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/10 bg-white transition-colors hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/product/${item.product.slug}`)}
                            className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[14px] leading-[20px] transition-colors ${
                              isB2B ? "hover:bg-[#ebf8ff]" : "hover:bg-[#fff1f0]"
                            }`}
                            style={{ color: modeColor }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Upraviť</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[14px] leading-[20px] text-[#e7000b] transition-colors hover:bg-[#fff1f0] disabled:cursor-not-allowed disabled:opacity-50"
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
              <Card className="rounded-[10px] border-black/10 p-4">
                <h3 className="mb-3 text-[18px] font-semibold leading-[27px] text-[#0a0a0a]">
                  Spôsob doručenia
                </h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("DPD_COURIER");
                      setDeliveryError(null);
                    }}
                    className={`w-full rounded-[10px] border p-3 text-left transition-colors ${
                      deliveryMethod === "DPD_COURIER"
                        ? "shadow-sm"
                        : "border-black/10 hover:border-[#bfbfc9]"
                    }`}
                    style={{
                      borderColor:
                        deliveryMethod === "DPD_COURIER" ? modeColor : undefined,
                      backgroundColor:
                        deliveryMethod === "DPD_COURIER" ? modeAccent : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Truck
                          className="h-5 w-5"
                          style={{
                            color:
                              deliveryMethod === "DPD_COURIER" ? modeColor : undefined,
                          }}
                        />
                        <div>
                          <div className="text-[16px] leading-[24px] text-[#0a0a0a]">
                            DPD kuriér
                          </div>
                          <div className="text-[12px] leading-[16px] text-[#717182]">
                            Doručenie na adresu
                          </div>
                        </div>
                      </div>
                      {courierShippingCost > 0 ? (
                        isB2B ? (
                          <div className="text-right">
                            <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                              {formatPrice(getNetVat(courierShippingCost).net)}
                            </div>
                            <div className="text-[12px] leading-[16px] text-[#717182]">
                              bez DPH (+ {formatPrice(getNetVat(courierShippingCost).vat)} DPH = {formatPrice(courierShippingCost)})
                            </div>
                          </div>
                        ) : (
                          <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                            {formatPrice(courierShippingCost)}
                          </div>
                        )
                      ) : (
                        <div className="text-[16px] leading-[24px] text-[#00a63e]">Zdarma</div>
                      )}
                    </div>
                  </button>

                  {pickupPointEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMethod("DPD_PICKUP");
                        setDeliveryError(null);
                      }}
                      className={`w-full rounded-[10px] border p-3 text-left transition-colors ${
                        deliveryMethod === "DPD_PICKUP"
                          ? "shadow-sm"
                          : "border-black/10 hover:border-[#bfbfc9]"
                      }`}
                      style={{
                        borderColor:
                          deliveryMethod === "DPD_PICKUP" ? modeColor : undefined,
                        backgroundColor:
                          deliveryMethod === "DPD_PICKUP" ? modeAccent : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin
                            className="h-5 w-5"
                            style={{
                              color:
                                deliveryMethod === "DPD_PICKUP" ? modeColor : undefined,
                            }}
                          />
                          <div>
                            <div className="text-[16px] leading-[24px] text-[#0a0a0a]">
                              DPD Pickup point
                            </div>
                            <div className="text-[12px] leading-[16px] text-[#717182]">
                              Odberné miesto / box
                            </div>
                          </div>
                        </div>
                        {pickupShippingCost > 0 ? (
                          isB2B ? (
                            <div className="text-right">
                              <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                                {formatPrice(getNetVat(pickupShippingCost).net)}
                              </div>
                              <div className="text-[12px] leading-[16px] text-[#717182]">
                                bez DPH (+ {formatPrice(getNetVat(pickupShippingCost).vat)} DPH = {formatPrice(pickupShippingCost)})
                              </div>
                            </div>
                          ) : (
                            <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                              {formatPrice(pickupShippingCost)}
                            </div>
                          )
                        ) : (
                          <div className="text-[16px] leading-[24px] text-[#00a63e]">
                            Zdarma
                          </div>
                        )}
                      </div>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("PERSONAL_PICKUP");
                      setPickupPoint(null);
                      setDeliveryError(null);
                    }}
                    className={`w-full rounded-[10px] border p-3 text-left transition-colors ${
                      deliveryMethod === "PERSONAL_PICKUP"
                        ? "shadow-sm"
                        : "border-black/10 hover:border-[#bfbfc9]"
                    }`}
                    style={{
                      borderColor:
                        deliveryMethod === "PERSONAL_PICKUP" ? modeColor : undefined,
                      backgroundColor:
                        deliveryMethod === "PERSONAL_PICKUP" ? modeAccent : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart
                          className="h-5 w-5"
                          style={{
                            color:
                              deliveryMethod === "PERSONAL_PICKUP" ? modeColor : undefined,
                          }}
                        />
                        <div>
                          <div className="text-[16px] leading-[24px] text-[#0a0a0a]">
                            Osobný odber
                          </div>
                          <div className="text-[12px] leading-[16px] text-[#717182]">
                            Košice, Rozvojová 2
                          </div>
                        </div>
                      </div>
                      <div className="text-[16px] leading-[24px] text-[#00a63e]">
                        Zdarma
                      </div>
                    </div>
                  </button>
                </div>

                {pickupPointEnabled && deliveryMethod === "DPD_PICKUP" ? (
                  <div className="mt-3 space-y-3 rounded-[10px] border border-black/10 p-3">
                    <ModeButton
                      mode={mode}
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={handleOpenPickupWidget}
                      disabled={isOpeningPickupWidget}
                      className="w-full"
                    >
                      {isOpeningPickupWidget ? "Otváram mapu..." : pickupPoint ? "Zmeniť odberné miesto" : "Vybrať odberné miesto na mape"}
                    </ModeButton>
                    {!dpdWidgetConfig.enabled ? (
                      <p className="text-xs text-muted-foreground">
                        Widget mapy je vypnutý v nastaveniach DPD.
                      </p>
                    ) : null}
                    {pickupPoint ? (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <div className="font-medium">{pickupPoint.name || "Odberné miesto DPD"}</div>
                        <div className="text-muted-foreground">
                          {pickupPoint.street}
                          <br />
                          {pickupPoint.zip} {pickupPoint.city}
                          <br />
                          {pickupPoint.country}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          PUS ID: {pickupPoint.parcelShopId}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Zatiaľ nie je vybrané odberné miesto.
                      </p>
                    )}
                  </div>
                ) : null}

                {deliveryError ? (
                  <p className="mt-3 text-sm text-red-600">{deliveryError}</p>
                ) : null}
              </Card>

              <Card className="rounded-[10px] border-black/10 p-4">
                <h3 className="mb-4 text-[18px] font-semibold leading-[27px] text-[#0a0a0a]">
                  Súhrn objednávky
                </h3>

                <div className="space-y-3 text-[14px] leading-[20px]">
                  <div className="flex justify-between">
                    <span className="text-[#717182]">Medzisúčet:</span>
                    {isB2B ? (
                      <div className="text-right">
                        <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                          {formatPrice(getNetVat(subtotal).net)}
                        </div>
                        <div className="text-[12px] leading-[16px] text-[#717182]">
                          bez DPH (+ {formatPrice(getNetVat(subtotal).vat)} DPH = {formatPrice(subtotal)})
                        </div>
                      </div>
                    ) : (
                      <span className="text-[18px] font-bold" style={{ color: modeColor }}>
                        {formatPrice(subtotal)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#717182]">Doprava:</span>
                    {shippingCost === 0 ? (
                      <span className="font-medium text-green-600">Zdarma</span>
                    ) : isB2B ? (
                      <div className="text-right">
                        <div className="text-[18px] font-bold" style={{ color: modeColor }}>
                          {formatPrice(getNetVat(shippingCost).net)}
                        </div>
                        <div className="text-[12px] leading-[16px] text-[#717182]">
                          bez DPH (+ {formatPrice(getNetVat(shippingCost).vat)} DPH = {formatPrice(shippingCost)})
                        </div>
                      </div>
                    ) : (
                      <span className="text-[18px] font-bold" style={{ color: modeColor }}>
                        {formatPrice(shippingCost)}
                      </span>
                    )}
                  </div>

                  {mode === "b2c" ? (
                    <div className="border-t border-black/10 pt-3">
                      <div className="flex justify-between text-[14px] font-semibold text-[#0a0a0a]">
                        <span>Celkom s DPH:</span>
                        <span className="text-[30px] leading-[36px]" style={{ color: modeColor }}>
                          {formatPrice(totalWithVAT)}
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] leading-[16px] text-[#717182]">
                        Obsahuje DPH {(normalizeVatRate * 100).toFixed(0)}%:{" "}
                        {formatPrice(vatAmount)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="border-t border-black/10 pt-3">
                        <div className="flex justify-between">
                          <span className="text-[#717182]">Celkom bez DPH:</span>
                          <div className="text-right">
                            <div className="text-[24px] font-bold" style={{ color: modeColor }}>
                              {formatPrice(totalWithoutVAT)}
                            </div>
                            <div className="text-[14px] leading-[20px] text-[#717182]">
                              bez DPH (+ {formatPrice(vatAmount)} DPH = {formatPrice(totalWithVAT)})
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between text-[12px] leading-[16px]">
                        <span className="text-[#717182]">
                          DPH {(normalizeVatRate * 100).toFixed(0)}%:
                        </span>
                        <span className="text-[#0a0a0a]">+{formatPrice(vatAmount)}</span>
                      </div>
                      <div className="border-t border-black/10 pt-3">
                        <div className="flex justify-between text-[14px] font-semibold text-[#0a0a0a]">
                          <span>Celkom s DPH:</span>
                          <span className="text-[18px] font-bold text-[#0a0a0a]">
                            {formatPrice(totalWithVAT)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div
                  className="mt-4 flex items-center gap-2 rounded-[10px] p-3"
                  style={{ backgroundColor: modeAccent }}
                >
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: modeColor }} />
                  <div className="text-[12px] leading-[16px]">
                    <span className="font-medium" style={{ color: modeColor }}>
                      Odhadovaná výroba:
                    </span>
                    <span className="ml-1 text-[#717182]">3-4 pracovné dni</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <ModeButton
                    mode={mode}
                    variant="primary"
                    size="md"
                    onClick={handleProceedToCheckout}
                    className="h-[56px] w-full rounded-[10px] text-[18px] font-medium"
                    disabled={isPending}
                  >
                    {mode === "b2c" ? "Pokračovať k platbe" : "Pokračovať k objednávke"}
                  </ModeButton>
                  {mode === "b2b" ? (
                    <ModeButton
                      mode={mode}
                      variant="outline"
                      size="md"
                      onClick={handleProceedToCheckout}
                      className="h-[48px] w-full rounded-[10px] text-[16px] font-medium"
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
                    className="h-[48px] w-full rounded-[10px] text-[16px] font-medium"
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

              {mode === "b2c" && subtotal < normalizedCourierFreeFrom && deliveryMethod !== "PERSONAL_PICKUP" ? (
                <div className="rounded-[10px] border-2 border-[#ffb86a] bg-[#fff7ed] px-[18px] pb-[2px] pt-[18px] text-center">
                  <div className="text-[14px] leading-[20px] text-[#7e2a0c]">
                    Pridajte ešte{" "}
                    <span className="mx-1 text-[18px] font-bold text-[#e74c3c]">
                      {formatPrice(normalizedCourierFreeFrom - subtotal)}
                    </span>
                  </div>
                  <div className="text-[14px] leading-[20px] text-[#7e2a0c]">
                    a získate dopravu zadarmo! 🎉
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {["Kontrola súborov zadarmo", "Bezpečná platba", "Expresné dodanie"].map(
            (item) => (
              <Card key={item} className="rounded-[14px] border-black/10 px-[25px] py-[25px] text-center">
                <div className="mb-3 flex justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="mb-2 text-[18px] font-semibold text-[#0a0a0a]">
                  {item}
                </h3>
                <p className="text-[14px] leading-[20px] text-[#717182]">
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
