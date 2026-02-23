"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminButton } from "@/components/admin/admin-button";
import { ConfiguratorOption } from "@/components/print/configurator-option";
import { QuantitySelector } from "@/components/print/quantity-selector";
import {
  useWpConfigurator,
  type WpConfiguratorData,
} from "@/components/print/use-wp-configurator";
import type { CustomerMode } from "@/components/print/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCsrfHeader } from "@/lib/csrf";

type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: {
    id: string;
    name: string;
  } | null;
};

type ConfiguredProduct = {
  id: string;
  name: string;
  slug: string;
  priceType: "ON_REQUEST" | "FIXED" | "MATRIX" | "AREA";
  priceFrom: number | null;
  priceAfterDiscountFrom: number | null;
  vatRate: number;
};

type ConfiguratorResponse = {
  product: ConfiguredProduct;
  calculatorData: WpConfiguratorData | null;
};

type PriceResult = {
  net: number;
  vatAmount: number;
  gross: number;
  currency: "EUR";
};

type ConfigSnapshot = {
  quantity: number;
  width: number | null;
  height: number | null;
  selections: Record<string, Record<string, string>>;
  selectedAttributes: Record<string, string>;
  productionSpeed: {
    id: "standard" | "accelerated";
    label: string;
    percent: number;
    days: number;
  };
};

export type CatalogDraftItem = {
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  width: string;
  height: string;
  selectedOptions?: Record<string, unknown>;
};

type OrderItemCatalogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience: string;
  onAddItem: (item: CatalogDraftItem) => void;
};

const SIMPLE_PRODUCTION_SPEED_OPTIONS: Array<{
  id: "standard" | "accelerated";
  label: string;
  percent: number;
  days: number;
}> = [
  {
    id: "standard",
    label: "Štandardná (do 5 dní)",
    percent: 0,
    days: 5,
  },
  {
    id: "accelerated",
    label: "Zrýchlene (do 2 dní)",
    percent: 30,
    days: 2,
  },
];

const formatMoneyInput = (value: number): string => value.toFixed(2);

const resolveVatPercent = (price: PriceResult, productVatRate: number): number => {
  if (price.net > 0) {
    return (price.vatAmount / price.net) * 100;
  }
  return productVatRate > 1 ? productVatRate : productVatRate * 100;
};

function MatrixConfiguratorPanel({
  mode,
  productId,
  data,
  isSubmitting,
  onConfirm,
}: {
  mode: CustomerMode;
  productId: string;
  data: WpConfiguratorData;
  isSubmitting: boolean;
  onConfirm: (snapshot: ConfigSnapshot) => void;
}) {
  const {
    selections,
    setSelections,
    quantity,
    setQuantity,
    width,
    height,
    setWidth,
    setHeight,
    minQuantity,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    widthLimitMessage,
    heightLimitMessage,
    dimUnit,
    hasAreaSizing,
    useQuantitySelect,
    visibleMatrices,
    total,
    productionSpeedOptions,
    productionSpeedId,
    setProductionSpeedId,
    hasUnavailable,
    quantityPresets,
  } = useWpConfigurator({ data, productId });

  const selectedProductionSpeed = useMemo(
    () =>
      productionSpeedOptions.find((option) => option.id === productionSpeedId) ??
      productionSpeedOptions[0],
    [productionSpeedId, productionSpeedOptions]
  );

  const handleConfirm = () => {
    if (!selectedProductionSpeed) return;
    const selectedAttributes: Record<string, string> = {};
    for (const matrix of visibleMatrices) {
      for (const select of matrix.selects) {
        const selectedValue = selections[matrix.mtid]?.[select.aid];
        if (!selectedValue) continue;
        const selectedOption = select.options.find((option) => option.value === selectedValue);
        if (!selectedOption) continue;
        selectedAttributes[select.label] = selectedOption.label;
      }
    }
    selectedAttributes["Rýchlosť výroby"] = selectedProductionSpeed.label;

    onConfirm({
      quantity,
      width,
      height,
      selections,
      selectedAttributes,
      productionSpeed: selectedProductionSpeed,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Množstvo</label>
        <QuantitySelector
          mode={mode}
          value={quantity}
          onChange={setQuantity}
          presets={quantityPresets}
          usePresetsSelect={useQuantitySelect}
          min={minQuantity}
        />
      </div>

      {hasAreaSizing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Šírka ({dimUnit})</span>
            <Input
              type="number"
              min={minWidth}
              max={maxWidth ?? undefined}
              value={width ?? ""}
              onChange={(event) =>
                setWidth(event.target.value === "" ? null : Number(event.target.value))
              }
            />
            {widthLimitMessage ? (
              <p className="text-xs text-destructive">{widthLimitMessage}</p>
            ) : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Výška ({dimUnit})</span>
            <Input
              type="number"
              min={minHeight}
              max={maxHeight ?? undefined}
              value={height ?? ""}
              onChange={(event) =>
                setHeight(event.target.value === "" ? null : Number(event.target.value))
              }
            />
            {heightLimitMessage ? (
              <p className="text-xs text-destructive">{heightLimitMessage}</p>
            ) : null}
          </label>
        </div>
      ) : null}

      <ConfiguratorOption
        mode={mode}
        label="Rýchlosť výroby"
        selected={productionSpeedId}
        onSelect={(value) => setProductionSpeedId(value as "standard" | "accelerated")}
        options={productionSpeedOptions.map((option) => ({
          id: option.id,
          label: option.label,
          recommended: option.id === "standard",
        }))}
      />

      {visibleMatrices.map((matrix) => (
        <div key={matrix.mtid} className="space-y-3">
          {matrix.selects.map((select) => (
            <ConfiguratorOption
              key={`${matrix.mtid}-${select.aid}`}
              mode={mode}
              label={select.label}
              selected={selections[matrix.mtid]?.[select.aid]}
              onSelect={(value) =>
                setSelections((current) => ({
                  ...current,
                  [matrix.mtid]: {
                    ...(current[matrix.mtid] ?? {}),
                    [select.aid]: value,
                  },
                }))
              }
              options={select.options.map((option) => ({
                id: option.value,
                label: option.label,
                recommended: option.selected,
              }))}
            />
          ))}
        </div>
      ))}

      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">Orientačná cena konfigurácie</p>
        <p className="mt-1 font-semibold">
          {hasUnavailable ? "Kombinácia nie je dostupná" : total === null ? "Doplňte konfiguráciu" : `${total.toFixed(2)} €`}
        </p>
      </div>

      <AdminButton
        variant="primary"
        onClick={handleConfirm}
        disabled={isSubmitting || hasUnavailable || total === null}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Pridávam...
          </>
        ) : (
          "Pridať položku do objednávky"
        )}
      </AdminButton>
    </div>
  );
}

function SimpleConfiguratorPanel({
  mode,
  isSubmitting,
  onConfirm,
}: {
  mode: CustomerMode;
  isSubmitting: boolean;
  onConfirm: (snapshot: ConfigSnapshot) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [productionSpeedId, setProductionSpeedId] = useState<"standard" | "accelerated">(
    "standard"
  );

  const selectedProductionSpeed = useMemo(
    () =>
      SIMPLE_PRODUCTION_SPEED_OPTIONS.find((option) => option.id === productionSpeedId) ??
      SIMPLE_PRODUCTION_SPEED_OPTIONS[0],
    [productionSpeedId]
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Množstvo</label>
        <QuantitySelector
          mode={mode}
          value={quantity}
          onChange={setQuantity}
          presets={[1, 10, 25, 50, 100]}
          usePresetsSelect={false}
          min={1}
        />
      </div>

      <ConfiguratorOption
        mode={mode}
        label="Rýchlosť výroby"
        selected={productionSpeedId}
        onSelect={(value) => setProductionSpeedId(value as "standard" | "accelerated")}
        options={SIMPLE_PRODUCTION_SPEED_OPTIONS.map((option) => ({
          id: option.id,
          label: option.label,
          recommended: option.id === "standard",
        }))}
      />

      <AdminButton
        variant="primary"
        onClick={() =>
          onConfirm({
            quantity,
            width: null,
            height: null,
            selections: {},
            selectedAttributes: {
              "Typ ceny": "Fixná cena",
              "Rýchlosť výroby": selectedProductionSpeed.label,
            },
            productionSpeed: selectedProductionSpeed,
          })
        }
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Pridávam...
          </>
        ) : (
          "Pridať položku do objednávky"
        )}
      </AdminButton>
    </div>
  );
}

export function OrderItemCatalogDialog({
  open,
  onOpenChange,
  audience,
  onAddItem,
}: OrderItemCatalogDialogProps) {
  const mode: CustomerMode = audience === "b2b" ? "b2b" : "b2c";
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [configByProductId, setConfigByProductId] = useState<Record<string, ConfiguratorResponse>>(
    {}
  );
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const selectedConfig = selectedProductId ? configByProductId[selectedProductId] : undefined;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoadingProducts(true);
      setProductsError(null);
      try {
        const params = new URLSearchParams();
        params.set("compact", "1");
        params.set("limit", "120");
        params.set("audience", mode);
        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }
        const response = await fetch(`/api/admin/products?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(payload?.error ?? "Nepodarilo sa načítať katalóg produktov.");
        }
        const normalized = payload as CatalogProduct[];
        setProducts(normalized);
        setSelectedProductId((prev) => {
          if (prev && normalized.some((item) => item.id === prev)) return prev;
          return normalized[0]?.id ?? null;
        });
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        setProductsError(
          error instanceof Error ? error.message : "Nepodarilo sa načítať katalóg produktov."
        );
      } finally {
        setIsLoadingProducts(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, mode, searchQuery]);

  useEffect(() => {
    if (!open || !selectedProductId) return;
    if (configByProductId[selectedProductId] || isLoadingConfig) return;

    let isMounted = true;
    const loadConfigurator = async () => {
      setIsLoadingConfig(true);
      setConfigError(null);
      try {
        const response = await fetch(`/api/admin/products/${selectedProductId}/configurator`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.product) {
          throw new Error(payload?.error ?? "Nepodarilo sa načítať konfigurátor produktu.");
        }
        if (!isMounted) return;
        setConfigByProductId((prev) => ({
          ...prev,
          [selectedProductId]: payload as ConfiguratorResponse,
        }));
      } catch (error) {
        if (!isMounted) return;
        setConfigError(
          error instanceof Error ? error.message : "Nepodarilo sa načítať konfigurátor produktu."
        );
      } finally {
        if (isMounted) {
          setIsLoadingConfig(false);
        }
      }
    };

    loadConfigurator();
    return () => {
      isMounted = false;
    };
  }, [open, selectedProductId, configByProductId, isLoadingConfig]);

  const handleAddConfiguredItem = async (snapshot: ConfigSnapshot) => {
    if (!selectedConfig) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          productId: selectedConfig.product.id,
          params: {
            quantity: snapshot.quantity,
            width: snapshot.width,
            height: snapshot.height,
            selections: snapshot.selections,
            productionSpeedPercent: snapshot.productionSpeed.percent,
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Nepodarilo sa vypočítať cenu.");
      }

      const price = payload as PriceResult;
      const safeQuantity = snapshot.quantity > 0 ? snapshot.quantity : 1;
      const unitNet = price.net / safeQuantity;
      const vatRatePercent = resolveVatPercent(price, selectedConfig.product.vatRate);

      onAddItem({
        productId: selectedConfig.product.id,
        name: selectedConfig.product.name,
        quantity: String(safeQuantity),
        unitPrice: formatMoneyInput(unitNet),
        vatRate: formatMoneyInput(vatRatePercent),
        width: snapshot.width === null ? "" : String(snapshot.width),
        height: snapshot.height === null ? "" : String(snapshot.height),
        selectedOptions: {
          ...snapshot.selections,
          _attributes: snapshot.selectedAttributes,
          _productionSpeed: snapshot.productionSpeed,
        },
      });

      toast.success("Položka bola pridaná do návrhu objednávky.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Položku sa nepodarilo pridať.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="w-[96vw] max-w-6xl p-0">
        <div className="grid max-h-[88vh] grid-rows-[auto_1fr]">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Pridať položku z katalógu</DialogTitle>
            <DialogDescription>
              Vyberte produkt a nastavte konfiguráciu pred pridaním do objednávky.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 md:grid-cols-[320px_1fr]">
            <div className="border-r p-4">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Hľadať v katalógu"
                />
              </div>

              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítavam produkty...
                </div>
              ) : productsError ? (
                <p className="text-sm text-destructive">{productsError}</p>
              ) : (
                <ScrollArea className="h-[62vh] pr-2">
                  <div className="space-y-2">
                    {products.map((product) => {
                      const isSelected = selectedProductId === product.id;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setSelectedProductId(product.id)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.category?.name ?? "Bez kategórie"}
                          </p>
                        </button>
                      );
                    })}
                    {products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Žiadne produkty.</p>
                    ) : null}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="min-h-0 p-4">
              {!selectedProductId ? (
                <p className="text-sm text-muted-foreground">Vyberte produkt z katalógu.</p>
              ) : isLoadingConfig && !selectedConfig ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítavam konfigurátor...
                </div>
              ) : configError && !selectedConfig ? (
                <p className="text-sm text-destructive">{configError}</p>
              ) : selectedConfig ? (
                <ScrollArea className="h-[62vh] pr-3">
                  <div className="space-y-4">
                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">{selectedConfig.product.name}</p>
                      <p className="text-muted-foreground">
                        Typ ceny: {selectedConfig.product.priceType}
                      </p>
                    </div>

                    {selectedConfig.calculatorData ? (
                      <MatrixConfiguratorPanel
                        mode={mode}
                        productId={selectedConfig.product.id}
                        data={selectedConfig.calculatorData}
                        isSubmitting={isAdding}
                        onConfirm={handleAddConfiguredItem}
                      />
                    ) : (
                      <SimpleConfiguratorPanel
                        mode={mode}
                        isSubmitting={isAdding}
                        onConfirm={handleAddConfiguredItem}
                      />
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">Vyberte produkt z katalógu.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
