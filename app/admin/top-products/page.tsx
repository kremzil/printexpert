"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

type Mode = "RANDOM_ALL" | "RANDOM_CATEGORIES" | "MANUAL";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
};

type Config = {
  mode: Mode;
  categoryIds: string[];
  productIds: string[];
};

export default function TopProductsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"b2c" | "b2b">("b2c");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [b2cConfig, setB2cConfig] = useState<Config>({
    mode: "RANDOM_ALL",
    categoryIds: [],
    productIds: [],
  });

  const [b2bConfig, setB2bConfig] = useState<Config>({
    mode: "RANDOM_ALL",
    categoryIds: [],
    productIds: [],
  });

  const [categories, setCategories] = useState<{
    b2c: Category[];
    b2b: Category[];
  }>({ b2c: [], b2b: [] });
  const [productsByAudience, setProductsByAudience] = useState<{
    b2c: Product[];
    b2b: Product[];
  }>({ b2c: [], b2b: [] });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [
        b2cRes,
        b2bRes,
        categoriesB2cRes,
        categoriesB2bRes,
        productsB2cRes,
        productsB2bRes,
      ] = await Promise.all([
        fetch("/api/admin/top-products?audience=b2c"),
        fetch("/api/admin/top-products?audience=b2b"),
        fetch("/api/admin/kategorie?audience=b2c"),
        fetch("/api/admin/kategorie?audience=b2b"),
        fetch("/api/admin/products?audience=b2c"),
        fetch("/api/admin/products?audience=b2b"),
      ]);

      const b2cData = await b2cRes.json();
      const b2bData = await b2bRes.json();
      const categoriesB2cData = await categoriesB2cRes.json();
      const categoriesB2bData = await categoriesB2bRes.json();
      const productsB2cData = await productsB2cRes.json();
      const productsB2bData = await productsB2bRes.json();

      const b2cCategoryIds = new Set(
        Array.isArray(categoriesB2cData) ? categoriesB2cData.map((item) => item.id) : []
      );
      const b2bCategoryIds = new Set(
        Array.isArray(categoriesB2bData) ? categoriesB2bData.map((item) => item.id) : []
      );
      const b2cProductIds = new Set(
        Array.isArray(productsB2cData) ? productsB2cData.map((item) => item.id) : []
      );
      const b2bProductIds = new Set(
        Array.isArray(productsB2bData) ? productsB2bData.map((item) => item.id) : []
      );

      setB2cConfig({
        ...b2cData,
        categoryIds: Array.isArray(b2cData?.categoryIds)
          ? b2cData.categoryIds.filter((id: string) => b2cCategoryIds.has(id))
          : [],
        productIds: Array.isArray(b2cData?.productIds)
          ? b2cData.productIds.filter((id: string) => b2cProductIds.has(id))
          : [],
      });
      setB2bConfig({
        ...b2bData,
        categoryIds: Array.isArray(b2bData?.categoryIds)
          ? b2bData.categoryIds.filter((id: string) => b2bCategoryIds.has(id))
          : [],
        productIds: Array.isArray(b2bData?.productIds)
          ? b2bData.productIds.filter((id: string) => b2bProductIds.has(id))
          : [],
      });
      setCategories({
        b2c: Array.isArray(categoriesB2cData) ? categoriesB2cData : [],
        b2b: Array.isArray(categoriesB2bData) ? categoriesB2bData : [],
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
        body: JSON.stringify({ audience, ...config }),
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
    const availableCategories =
      audience === "b2c" ? categories.b2c : categories.b2b;

    const selectedCategories = availableCategories.filter((cat) =>
      config.categoryIds.includes(cat.id)
    );
    const selectedProducts = availableProducts.filter((prod) =>
      config.productIds.includes(prod.id)
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Top produkty pre {audience.toUpperCase()}</CardTitle>
          <CardDescription>
            Nastavte spôsob výberu top produktov pre {audience === "b2c" ? "B2C" : "B2B"} režim
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Režim výberu</Label>
            <RadioGroup
              value={config.mode}
              onValueChange={(value) =>
                setConfig({ ...config, mode: value as Mode })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="RANDOM_ALL" id={`${audience}-random-all`} />
                <Label htmlFor={`${audience}-random-all`} className="font-normal">
                  Náhodný výber zo všetkých produktov
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="RANDOM_CATEGORIES" id={`${audience}-random-cat`} />
                <Label htmlFor={`${audience}-random-cat`} className="font-normal">
                  Náhodný výber z vybraných kategórií
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MANUAL" id={`${audience}-manual`} />
                <Label htmlFor={`${audience}-manual`} className="font-normal">
                  Ručný výber produktov
                </Label>
              </div>
            </RadioGroup>
          </div>

          {config.mode === "RANDOM_CATEGORIES" && (
            <div className="space-y-2">
              <Label>Vybrané kategórie</Label>
              <CategoryCombobox
                categories={availableCategories}
                selected={selectedCategories}
                onChange={(selected) =>
                  setConfig({ ...config, categoryIds: selected.map((c) => c.id) })
                }
              />
            </div>
          )}

          {config.mode === "MANUAL" && (
            <div className="space-y-2">
              <Label>Vybrané produkty</Label>
              <ProductCombobox
                products={availableProducts}
                selected={selectedProducts}
                onChange={(selected) =>
                  setConfig({ ...config, productIds: selected.map((p) => p.id) })
                }
              />
              <p className="text-sm text-muted-foreground">
                Vyberte až 8 produktov.
              </p>
            </div>
          )}

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

function CategoryCombobox({
  categories,
  selected,
  onChange,
}: {
  categories: Category[];
  selected: Category[];
  onChange: (selected: Category[]) => void;
}) {
  const anchor = useComboboxAnchor();

  return (
    <Combobox
      multiple
      autoHighlight
      items={categories}
      value={selected}
      onValueChange={onChange}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: Category[]) => (
            <React.Fragment>
              {values.map((value) => (
                <ComboboxChip key={value.id}>{value.name}</ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder="Vyberte kategórie..." />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Žiadne kategórie nenájdené.</ComboboxEmpty>
        <ComboboxList>
          {(item: Category) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
