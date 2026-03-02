"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { GripVertical, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AdminButton as Button } from "@/components/admin/admin-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeader } from "@/lib/csrf";
import { resolveProductImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

type Mode = "MANUAL";

type Product = {
  id: string;
  name: string;
  slug: string;
  category?: { id: string; name: string } | null;
  images?: { url: string; alt: string | null }[];
};

type Config = {
  mode: Mode;
  productIds: string[];
};

export default function TopProductsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"b2c" | "b2b">("b2c");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [b2cConfig, setB2cConfig] = useState<Config>({
    mode: "MANUAL",
    productIds: [],
  });

  const [b2bConfig, setB2bConfig] = useState<Config>({
    mode: "MANUAL",
    productIds: [],
  });

  const [productsByAudience, setProductsByAudience] = useState<{
    b2c: Product[];
    b2b: Product[];
  }>({ b2c: [], b2b: [] });
  const [categoryFilterByAudience, setCategoryFilterByAudience] = useState<{ b2c: string; b2b: string }>({
    b2c: "all",
    b2b: "all",
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [
        b2cRes,
        b2bRes,
        productsB2cRes,
        productsB2bRes,
      ] = await Promise.all([
        fetch("/api/admin/top-products?audience=b2c"),
        fetch("/api/admin/top-products?audience=b2b"),
        fetch("/api/admin/products?audience=b2c"),
        fetch("/api/admin/products?audience=b2b"),
      ]);

      const b2cData = await b2cRes.json();
      const b2bData = await b2bRes.json();
      const productsB2cData = await productsB2cRes.json();
      const productsB2bData = await productsB2bRes.json();

      const b2cProductIds = new Set(
        Array.isArray(productsB2cData) ? productsB2cData.map((item) => item.id) : []
      );
      const b2bProductIds = new Set(
        Array.isArray(productsB2bData) ? productsB2bData.map((item) => item.id) : []
      );

      setB2cConfig({
        mode: "MANUAL",
        productIds: Array.isArray(b2cData?.productIds)
          ? b2cData.productIds.filter((id: string) => b2cProductIds.has(id))
          : [],
      });
      setB2bConfig({
        mode: "MANUAL",
        productIds: Array.isArray(b2bData?.productIds)
          ? b2bData.productIds.filter((id: string) => b2bProductIds.has(id))
          : [],
      });
      setProductsByAudience({
        b2c: Array.isArray(productsB2cData) ? productsB2cData : [],
        b2b: Array.isArray(productsB2bData) ? productsB2bData : [],
      });
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať dáta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveConfig(audience: "b2c" | "b2b") {
    setSaving(true);
    const config = audience === "b2c" ? b2cConfig : b2bConfig;

    try {
      const res = await fetch("/api/admin/top-products", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ audience, mode: "MANUAL", productIds: config.productIds }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast({
        title: "Uložené",
        description: `Nastavenia pre ${audience.toUpperCase()} boli úspešne uložené`,
      });
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa uložiť nastavenia",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function renderConfig(audience: "b2c" | "b2b") {
    const config = audience === "b2c" ? b2cConfig : b2bConfig;
    const setConfig = audience === "b2c" ? setB2cConfig : setB2bConfig;
    const availableProducts =
      audience === "b2c" ? productsByAudience.b2c : productsByAudience.b2b;
    const selectedCategory = categoryFilterByAudience[audience];
    const categoryOptions = Array.from(
      new Map(
        availableProducts
          .filter((product) => product.category?.id && product.category?.name)
          .map((product) => [product.category?.id as string, product.category?.name as string])
      ).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));
    const filteredProducts =
      selectedCategory === "all"
        ? availableProducts
        : selectedCategory === "none"
          ? availableProducts.filter((product) => !product.category)
          : availableProducts.filter((product) => product.category?.id === selectedCategory);

    const productById = new Map(availableProducts.map((product) => [product.id, product]));
    const selectedProducts = config.productIds
      .map((id) => productById.get(id))
      .filter((product): product is Product => Boolean(product));

    const syncSelected = (selected: Product[]) => {
      const selectedIds = selected.map((product) => product.id).slice(0, 8);
      const kept = config.productIds.filter((id) => selectedIds.includes(id));
      const appended = selectedIds.filter((id) => !kept.includes(id));
      setConfig({ ...config, productIds: [...kept, ...appended].slice(0, 8) });
    };

    const reorderSelected = (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      const current = [...config.productIds];
      const fromIndex = current.indexOf(draggedId);
      const toIndex = current.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0) return;
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      setConfig({ ...config, productIds: current });
    };

    const removeSelected = (productId: string) => {
      setConfig({ ...config, productIds: config.productIds.filter((id) => id !== productId) });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Top produkty pre {audience.toUpperCase()}</CardTitle>
          <CardDescription>
            Vyberte produkty, ktoré sa zobrazia na úvodnej stránke v {audience === "b2c" ? "B2C" : "B2B"} režime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Vybrané produkty</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor={`top-products-category-${audience}`} className="text-xs text-muted-foreground">
                Kategória
              </Label>
              <select
                id={`top-products-category-${audience}`}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={selectedCategory}
                onChange={(event) =>
                  setCategoryFilterByAudience((prev) => ({ ...prev, [audience]: event.target.value }))
                }
              >
                <option value="all">Všetky kategórie</option>
                <option value="none">Bez kategórie</option>
                {categoryOptions.map(([categoryId, categoryName]) => (
                  <option key={categoryId} value={categoryId}>
                    {categoryName}
                  </option>
                ))}
              </select>
            </div>
            <ProductCombobox
              products={filteredProducts}
              selected={selectedProducts}
              onChange={syncSelected}
            />
            <p className="text-sm text-muted-foreground">Vybrané: {selectedProducts.length} / 8</p>
          </div>

          {selectedProducts.length > 0 ? (
            <div className="space-y-2">
              <Label>Poradie zobrazenia (drag & drop)</Label>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {selectedProducts.map((product) => (
                  <ReorderItem
                    key={product.id}
                    product={product}
                    onMove={reorderSelected}
                    onRemove={removeSelected}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            Vyberte maximálne 8 produktov. Poradie v zozname určuje poradie na vitrine.
          </div>

          <Button onClick={() => saveConfig(audience)} disabled={saving}>
            {saving ? "Ukladám..." : "Uložiť nastavenia"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <div className="p-6">Načítavam...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Top produkty</h1>
        <p className="text-muted-foreground">
          Nastavenie zobrazenia top produktov pre B2C a B2B režimy
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "b2c" | "b2b")}>
        <TabsList>
          <TabsTrigger value="b2c">B2C</TabsTrigger>
          <TabsTrigger value="b2b">B2B</TabsTrigger>
        </TabsList>
        <TabsContent value="b2c" className="mt-6">
          {renderConfig("b2c")}
        </TabsContent>
        <TabsContent value="b2b" className="mt-6">
          {renderConfig("b2b")}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReorderItem({
  product,
  onMove,
  onRemove,
}: {
  product: Product;
  onMove: (draggedId: string, targetId: string) => void;
  onRemove: (productId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const primaryImage = product.images?.[0];
  const imageUrl = resolveProductImageUrl(primaryImage?.url);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", product.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain");
        setIsDragOver(false);
        onMove(draggedId, product.id);
      }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="relative h-8 w-8 overflow-hidden rounded-md border bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={primaryImage?.alt || product.name}
            fill
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{product.name}</div>
        <div className="truncate text-xs text-muted-foreground">/{product.slug}</div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(product.id)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Odstrániť ${product.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductCombobox({
  products,
  selected,
  onChange,
}: {
  products: Product[];
  selected: Product[];
  onChange: (selected: Product[]) => void;
}) {
  const anchor = useComboboxAnchor();

  return (
    <Combobox
      multiple
      autoHighlight
      items={products}
      value={selected}
      onValueChange={onChange}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: Product[]) => (
            <React.Fragment>
              {values.map((value) => (
                <ComboboxChip key={value.id}>{value.name}</ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder="Vyberte produkty..." />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Žiadne produkty nenájdené.</ComboboxEmpty>
        <ComboboxList>
          {(item: Product) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
