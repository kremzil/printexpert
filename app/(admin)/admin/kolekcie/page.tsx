"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type Product = {
  id: string;
  name: string;
  slug: string;
};

type ProductCollection = {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string | null;
  productIds: string[];
  isActive: boolean;
  showInB2b: boolean;
  showInB2c: boolean;
  sortOrder: number;
};

type CollectionDraft = {
  name: string;
  slug: string;
  image: string;
  description: string;
  productIds: string[];
  isActive: boolean;
  showInB2b: boolean;
  showInB2c: boolean;
  sortOrder: number;
};

const createEmptyDraft = (): CollectionDraft => ({
  name: "",
  slug: "",
  image: "",
  description: "",
  productIds: [],
  isActive: true,
  showInB2b: true,
  showInB2c: true,
  sortOrder: 0,
});

const draftFromCollection = (collection: ProductCollection): CollectionDraft => ({
  name: collection.name,
  slug: collection.slug,
  image: collection.image,
  description: collection.description ?? "",
  productIds: collection.productIds ?? [],
  isActive: collection.isActive,
  showInB2b: collection.showInB2b,
  showInB2c: collection.showInB2c,
  sortOrder: collection.sortOrder,
});

const mergeSelectedProductIds = (currentIds: string[], selected: Product[]) => {
  const selectedIds = selected.map((product) => product.id);
  const kept = currentIds.filter((id) => selectedIds.includes(id));
  const appended = selectedIds.filter((id) => !kept.includes(id));
  return [...kept, ...appended];
};

const moveProductId = (
  productIds: string[],
  index: number,
  direction: "up" | "down"
) => {
  if (direction === "up" && index <= 0) return productIds;
  if (direction === "down" && index >= productIds.length - 1) return productIds;

  const next = [...productIds];
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
};

function ProductPicker({
  products,
  selectedIds,
  onChange,
}: {
  products: Product[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
}) {
  const anchor = useComboboxAnchor();
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const selectedProducts = selectedIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product));

  return (
    <Combobox
      multiple
      autoHighlight
      items={products}
      value={selectedProducts}
      onValueChange={(next) => onChange(mergeSelectedProductIds(selectedIds, next))}
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

function SelectedProductsOrder({
  productIds,
  productsById,
  onMove,
  onRemove,
}: {
  productIds: string[];
  productsById: Map<string, Product>;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (productId: string) => void;
}) {
  if (productIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Zatiaľ nie sú vybrané žiadne produkty.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {productIds.map((productId, index) => {
        const product = productsById.get(productId);
        if (!product) return null;

        return (
          <div
            key={productId}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium">{product.name}</div>
              <div className="text-xs text-muted-foreground">{product.slug}</div>
            </div>
            <div className="flex items-center gap-1">
              <AdminButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(index, "up")}
                disabled={index === 0}
              >
                <ArrowUp className="h-4 w-4" />
              </AdminButton>
              <AdminButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(index, "down")}
                disabled={index === productIds.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </AdminButton>
              <AdminButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(productId)}
              >
                <Trash2 className="h-4 w-4" />
              </AdminButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminCollectionsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [uploadingCreate, setUploadingCreate] = useState(false);
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({});

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<ProductCollection[]>([]);
  const [createDraft, setCreateDraft] = useState<CollectionDraft>(createEmptyDraft());
  const [editDrafts, setEditDrafts] = useState<Record<string, CollectionDraft>>({});

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [collectionsResponse, productsResponse] = await Promise.all([
        fetch("/api/admin/collections"),
        fetch("/api/admin/products"),
      ]);

      if (!collectionsResponse.ok || !productsResponse.ok) {
        throw new Error("Nepodarilo sa načítať dáta.");
      }

      const collectionsData = (await collectionsResponse.json()) as ProductCollection[];
      const productsData = (await productsResponse.json()) as Product[];

      const normalizedCollections = Array.isArray(collectionsData)
        ? collectionsData
        : [];
      const normalizedProducts = Array.isArray(productsData) ? productsData : [];

      setCollections(normalizedCollections);
      setProducts(normalizedProducts);
      setEditDrafts(
        normalizedCollections.reduce<Record<string, CollectionDraft>>((acc, collection) => {
          acc[collection.id] = draftFromCollection(collection);
          return acc;
        }, {})
      );
    } catch (error) {
      console.error("Failed to load collections:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať kolekcie.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const uploadImage = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "image");

      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: getCsrfHeader(),
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Nepodarilo sa nahrať obrázok.");
      }

      const payload = (await response.json()) as { url: string };
      return payload.url;
    },
    []
  );

  const handleCreate = async () => {
    if (!createDraft.name.trim() || !createDraft.image.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte názov a obrázok kolekcie.",
        variant: "destructive",
      });
      return;
    }

    setSavingCreate(true);
    try {
      const response = await fetch("/api/admin/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          ...createDraft,
          sortOrder: Number(createDraft.sortOrder) || 0,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Nepodarilo sa vytvoriť kolekciu.");
      }

      toast({
        title: "Uložené",
        description: "Kolekcia bola vytvorená.",
      });
      setCreateDraft(createEmptyDraft());
      await loadData();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error
            ? error.message
            : "Nepodarilo sa vytvoriť kolekciu.",
        variant: "destructive",
      });
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (collectionId: string) => {
    const draft = editDrafts[collectionId];
    if (!draft) return;
    if (!draft.name.trim() || !draft.image.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte názov a obrázok kolekcie.",
        variant: "destructive",
      });
      return;
    }

    setSavingById((prev) => ({ ...prev, [collectionId]: true }));
    try {
      const response = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          ...draft,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Nepodarilo sa uložiť kolekciu.");
      }

      toast({
        title: "Uložené",
        description: "Kolekcia bola aktualizovaná.",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error
            ? error.message
            : "Nepodarilo sa uložiť kolekciu.",
        variant: "destructive",
      });
    } finally {
      setSavingById((prev) => ({ ...prev, [collectionId]: false }));
    }
  };

  const handleDelete = async (collectionId: string, collectionName: string) => {
    const confirmed = window.confirm(
      `Naozaj chcete odstrániť kolekciu „${collectionName}“?`
    );
    if (!confirmed) return;

    setDeletingById((prev) => ({ ...prev, [collectionId]: true }));
    try {
      const response = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "DELETE",
        headers: getCsrfHeader(),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Nepodarilo sa odstrániť kolekciu.");
      }

      toast({
        title: "Odstránené",
        description: "Kolekcia bola odstránená.",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error
            ? error.message
            : "Nepodarilo sa odstrániť kolekciu.",
        variant: "destructive",
      });
    } finally {
      setDeletingById((prev) => ({ ...prev, [collectionId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Načítavam kolekcie...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kolekcie</h1>
        <p className="text-muted-foreground">
          Spravujte kolekcie produktov pre B2B a B2C režim.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nová kolekcia</CardTitle>
          <CardDescription>
            Vytvorte novú kolekciu, vyberte produkty a poradie zobrazenia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Názov</Label>
              <Input
                id="create-name"
                value={createDraft.name}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Napr. Jarná kolekcia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-slug">Slug</Label>
              <Input
                id="create-slug"
                value={createDraft.slug}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, slug: event.target.value }))
                }
                placeholder="Voliteľné, doplní sa automaticky"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-image">Obrázok (URL)</Label>
            <div className="flex gap-2">
              <Input
                id="create-image"
                value={createDraft.image}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, image: event.target.value }))
                }
                placeholder="/uploads/... alebo https://..."
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                <Upload className="h-4 w-4" />
                Nahrať
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCreate}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;

                    setUploadingCreate(true);
                    try {
                      const url = await uploadImage(file);
                      setCreateDraft((prev) => ({ ...prev, image: url }));
                      toast({
                        title: "Nahraté",
                        description: "Obrázok bol úspešne nahraný.",
                      });
                    } catch (error) {
                      toast({
                        title: "Chyba",
                        description:
                          error instanceof Error
                            ? error.message
                            : "Nepodarilo sa nahrať obrázok.",
                        variant: "destructive",
                      });
                    } finally {
                      setUploadingCreate(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Popis</Label>
            <Textarea
              id="create-description"
              value={createDraft.description}
              onChange={(event) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Krátky popis kolekcie..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-sortOrder">Poradie</Label>
              <Input
                id="create-sortOrder"
                type="number"
                value={createDraft.sortOrder}
                onChange={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    sortOrder: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Viditeľnosť</Label>
              <div className="flex flex-wrap gap-4 rounded-md border px-3 py-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createDraft.isActive}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>Aktívna</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createDraft.showInB2b}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        showInB2b: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>B2B</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createDraft.showInB2c}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        showInB2c: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>B2C</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produkty</Label>
            <ProductPicker
              products={products}
              selectedIds={createDraft.productIds}
              onChange={(nextIds) =>
                setCreateDraft((prev) => ({ ...prev, productIds: nextIds }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Poradie produktov v kolekcii</Label>
            <SelectedProductsOrder
              productIds={createDraft.productIds}
              productsById={productsById}
              onMove={(index, direction) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  productIds: moveProductId(prev.productIds, index, direction),
                }))
              }
              onRemove={(productId) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  productIds: prev.productIds.filter((id) => id !== productId),
                }))
              }
            />
          </div>

          <AdminButton
            type="button"
            onClick={handleCreate}
            disabled={savingCreate || uploadingCreate}
          >
            {savingCreate ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ukladám...
              </span>
            ) : (
              "Vytvoriť kolekciu"
            )}
          </AdminButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existujúce kolekcie</CardTitle>
          <CardDescription>Celkom kolekcií: {collections.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatiaľ nie sú vytvorené žiadne kolekcie.
            </p>
          ) : (
            collections.map((collection) => {
              const draft = editDrafts[collection.id];
              if (!draft) return null;

              const isSaving = Boolean(savingById[collection.id]);
              const isDeleting = Boolean(deletingById[collection.id]);
              const isUploading = Boolean(uploadingById[collection.id]);

              return (
                <div key={collection.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{collection.name}</h3>
                    <div className="text-xs text-muted-foreground">
                      ID: {collection.id}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Názov</Label>
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [collection.id]: {
                              ...prev[collection.id],
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        value={draft.slug}
                        onChange={(event) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [collection.id]: {
                              ...prev[collection.id],
                              slug: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Obrázok (URL)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={draft.image}
                        onChange={(event) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [collection.id]: {
                              ...prev[collection.id],
                              image: event.target.value,
                            },
                          }))
                        }
                      />
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                        <Upload className="h-4 w-4" />
                        Nahrať
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploading}
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) return;

                            setUploadingById((prev) => ({
                              ...prev,
                              [collection.id]: true,
                            }));
                            try {
                              const url = await uploadImage(file);
                              setEditDrafts((prev) => ({
                                ...prev,
                                [collection.id]: {
                                  ...prev[collection.id],
                                  image: url,
                                },
                              }));
                              toast({
                                title: "Nahraté",
                                description: "Obrázok bol úspešne nahraný.",
                              });
                            } catch (error) {
                              toast({
                                title: "Chyba",
                                description:
                                  error instanceof Error
                                    ? error.message
                                    : "Nepodarilo sa nahrať obrázok.",
                                variant: "destructive",
                              });
                            } finally {
                              setUploadingById((prev) => ({
                                ...prev,
                                [collection.id]: false,
                              }));
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Popis</Label>
                    <Textarea
                      rows={3}
                      value={draft.description}
                      onChange={(event) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [collection.id]: {
                            ...prev[collection.id],
                            description: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Poradie</Label>
                      <Input
                        type="number"
                        value={draft.sortOrder}
                        onChange={(event) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [collection.id]: {
                              ...prev[collection.id],
                              sortOrder: Number(event.target.value) || 0,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Viditeľnosť</Label>
                      <div className="flex flex-wrap gap-4 rounded-md border px-3 py-2 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(event) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [collection.id]: {
                                  ...prev[collection.id],
                                  isActive: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span>Aktívna</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.showInB2b}
                            onChange={(event) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [collection.id]: {
                                  ...prev[collection.id],
                                  showInB2b: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span>B2B</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.showInB2c}
                            onChange={(event) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [collection.id]: {
                                  ...prev[collection.id],
                                  showInB2c: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span>B2C</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Produkty</Label>
                    <ProductPicker
                      products={products}
                      selectedIds={draft.productIds}
                      onChange={(nextIds) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [collection.id]: {
                            ...prev[collection.id],
                            productIds: nextIds,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Poradie produktov v kolekcii</Label>
                    <SelectedProductsOrder
                      productIds={draft.productIds}
                      productsById={productsById}
                      onMove={(index, direction) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [collection.id]: {
                            ...prev[collection.id],
                            productIds: moveProductId(
                              prev[collection.id].productIds,
                              index,
                              direction
                            ),
                          },
                        }))
                      }
                      onRemove={(productId) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [collection.id]: {
                            ...prev[collection.id],
                            productIds: prev[collection.id].productIds.filter(
                              (id) => id !== productId
                            ),
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <AdminButton
                      type="button"
                      onClick={() => void handleUpdate(collection.id)}
                      disabled={isSaving || isDeleting || isUploading}
                    >
                      {isSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Ukladám...
                        </span>
                      ) : (
                        "Uložiť zmeny"
                      )}
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant="outline"
                      onClick={() => void handleDelete(collection.id, collection.name)}
                      disabled={isSaving || isDeleting}
                    >
                      {isDeleting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Odstraňujem...
                        </span>
                      ) : (
                        "Odstrániť"
                      )}
                    </AdminButton>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
