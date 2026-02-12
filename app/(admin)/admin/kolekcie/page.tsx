"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

const moveProductId = (productIds: string[], index: number, direction: "up" | "down") => {
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
  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => productById.get(id))
        .filter((product): product is Product => Boolean(product)),
    [selectedIds, productById]
  );

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
      <ComboboxContent anchor={anchor} className="max-h-80">
        <ComboboxEmpty>Žiadne produkty nenájdené.</ComboboxEmpty>
        <ComboboxList
          showScrollbar
          className="max-h-64 overflow-y-auto"
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const element = event.currentTarget as HTMLElement;
            element.scrollTop += event.deltaY;
          }}
        >
          {(item: Product) => (
            <ComboboxItem
              key={item.id}
              value={item}
              className={`pr-2 [&>span:last-child]:hidden ${
                selectedIds.includes(item.id)
                  ? "bg-primary/15 text-primary font-medium"
                  : ""
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.slug}</span>
              </div>
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
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
      {productIds.map((productId, index) => {
        const product = productsById.get(productId);
        if (!product) return null;

        return (
          <div
            key={productId}
            className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{product.name}</div>
              <div className="truncate text-xs text-muted-foreground">{product.slug}</div>
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

function CollectionFormFields({
  idPrefix,
  draft,
  onChange,
  products,
  productsById,
  uploading,
  onUploadImage,
}: {
  idPrefix: string;
  draft: CollectionDraft;
  onChange: (nextDraft: CollectionDraft) => void;
  products: Product[];
  productsById: Map<string, Product>;
  uploading: boolean;
  onUploadImage: (file: File) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Názov</Label>
          <Input
            id={`${idPrefix}-name`}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Napr. Jarná kolekcia"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
          <Input
            id={`${idPrefix}-slug`}
            value={draft.slug}
            onChange={(event) => onChange({ ...draft, slug: event.target.value })}
            placeholder="Voliteľné, doplní sa automaticky"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-image`}>Obrázok (URL)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={`${idPrefix}-image`}
            value={draft.image}
            onChange={(event) => onChange({ ...draft, image: event.target.value })}
            placeholder="/uploads/... alebo https://..."
          />
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm">
            <Upload className="h-4 w-4" />
            {uploading ? "Nahrávam..." : "Nahrať"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                await onUploadImage(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Popis</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Krátky popis kolekcie..."
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-sortOrder`}>Poradie</Label>
          <Input
            id={`${idPrefix}-sortOrder`}
            type="number"
            value={draft.sortOrder}
            onChange={(event) =>
              onChange({
                ...draft,
                sortOrder: Number(event.target.value) || 0,
              })
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
                onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span>Aktívna</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showInB2b}
                onChange={(event) => onChange({ ...draft, showInB2b: event.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span>B2B</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showInB2c}
                onChange={(event) => onChange({ ...draft, showInB2c: event.target.checked })}
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
          onChange={(nextIds) => onChange({ ...draft, productIds: nextIds })}
        />
      </div>

      <div className="space-y-2">
        <Label>Poradie produktov v kolekcii</Label>
        <SelectedProductsOrder
          productIds={draft.productIds}
          productsById={productsById}
          onMove={(index, direction) =>
            onChange({
              ...draft,
              productIds: moveProductId(draft.productIds, index, direction),
            })
          }
          onRemove={(productId) =>
            onChange({
              ...draft,
              productIds: draft.productIds.filter((id) => id !== productId),
            })
          }
        />
      </div>
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogCollectionId, setEditDialogCollectionId] = useState<string | null>(null);

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

      const normalizedCollections = Array.isArray(collectionsData) ? collectionsData : [];
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

  const uploadImage = useCallback(async (file: File) => {
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
  }, []);

  const handleCreateUpload = useCallback(
    async (file: File) => {
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
            error instanceof Error ? error.message : "Nepodarilo sa nahrať obrázok.",
          variant: "destructive",
        });
      } finally {
        setUploadingCreate(false);
      }
    },
    [toast, uploadImage]
  );

  const handleEditUpload = useCallback(
    async (collectionId: string, file: File) => {
      setUploadingById((prev) => ({ ...prev, [collectionId]: true }));
      try {
        const url = await uploadImage(file);
        setEditDrafts((prev) => ({
          ...prev,
          [collectionId]: {
            ...prev[collectionId],
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
            error instanceof Error ? error.message : "Nepodarilo sa nahrať obrázok.",
          variant: "destructive",
        });
      } finally {
        setUploadingById((prev) => ({ ...prev, [collectionId]: false }));
      }
    },
    [toast, uploadImage]
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
      setCreateDialogOpen(false);
      await loadData();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error ? error.message : "Nepodarilo sa vytvoriť kolekciu.",
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
      setEditDialogCollectionId(null);
      await loadData();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error ? error.message : "Nepodarilo sa uložiť kolekciu.",
        variant: "destructive",
      });
    } finally {
      setSavingById((prev) => ({ ...prev, [collectionId]: false }));
    }
  };

  const handleDelete = async (collectionId: string, collectionName: string) => {
    const confirmed = window.confirm(`Naozaj chcete odstrániť kolekciu „${collectionName}“?`);
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
          error instanceof Error ? error.message : "Nepodarilo sa odstrániť kolekciu.",
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kolekcie</h1>
          <p className="text-muted-foreground">
            Spravujte kolekcie produktov pre B2B a B2C režim.
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <AdminButton type="button">+ Nová kolekcia</AdminButton>
          </DialogTrigger>
          <DialogContent size="lg" className="max-h-[96vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nová kolekcia</DialogTitle>
              <DialogDescription>
                Vyplňte údaje kolekcie, vyberte produkty a nastavte ich poradie.
              </DialogDescription>
            </DialogHeader>

            <CollectionFormFields
              idPrefix="create-collection"
              draft={createDraft}
              onChange={setCreateDraft}
              products={products}
              productsById={productsById}
              uploading={uploadingCreate}
              onUploadImage={handleCreateUpload}
            />

            <DialogFooter>
              <AdminButton
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={savingCreate || uploadingCreate}
              >
                Zrušiť
              </AdminButton>
              <AdminButton
                type="button"
                onClick={() => void handleCreate()}
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existujúce kolekcie</CardTitle>
          <CardDescription>Celkom kolekcií: {collections.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatiaľ nie sú vytvorené žiadne kolekcie.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kolekcia</TableHead>
                  <TableHead>Stav a režim</TableHead>
                  <TableHead>Poradie</TableHead>
                  <TableHead>Produkty</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => {
                  const draft = editDrafts[collection.id];
                  if (!draft) return null;

                  const isSaving = Boolean(savingById[collection.id]);
                  const isDeleting = Boolean(deletingById[collection.id]);
                  const isUploading = Boolean(uploadingById[collection.id]);
                  const previewProducts = draft.productIds
                    .map((id) => productsById.get(id))
                    .filter((item): item is Product => Boolean(item))
                    .slice(0, 3);
                  const moreProducts = Math.max(draft.productIds.length - previewProducts.length, 0);

                  return (
                    <TableRow key={collection.id}>
                      <TableCell className="align-top whitespace-normal">
                        <div className="font-medium">{draft.name}</div>
                        <div className="text-xs text-muted-foreground">{draft.slug}</div>
                      </TableCell>

                      <TableCell className="align-top whitespace-normal">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={draft.isActive ? "default" : "secondary"}>
                            {draft.isActive ? "Aktívna" : "Neaktívna"}
                          </Badge>
                          {draft.showInB2b ? <Badge variant="outline">B2B</Badge> : null}
                          {draft.showInB2c ? <Badge variant="outline">B2C</Badge> : null}
                          {!draft.showInB2b && !draft.showInB2c ? (
                            <Badge variant="secondary">Skryté</Badge>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="align-top whitespace-normal">
                        {draft.sortOrder}
                      </TableCell>

                      <TableCell className="max-w-[340px] align-top whitespace-normal">
                        <div className="text-sm font-medium">{draft.productIds.length} produktov</div>
                        {previewProducts.length > 0 ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {previewProducts.map((product) => product.name).join(", ")}
                            {moreProducts > 0 ? ` +${moreProducts}` : ""}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground">Bez produktov</div>
                        )}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Dialog
                            open={editDialogCollectionId === collection.id}
                            onOpenChange={(open) =>
                              setEditDialogCollectionId(open ? collection.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <AdminButton type="button" variant="outline" size="sm">
                                Upraviť
                              </AdminButton>
                            </DialogTrigger>
                            <DialogContent size="lg" className="max-h-[96vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Upraviť kolekciu</DialogTitle>
                              </DialogHeader>

                              <CollectionFormFields
                                idPrefix={`edit-${collection.id}`}
                                draft={draft}
                                onChange={(nextDraft) =>
                                  setEditDrafts((prev) => ({
                                    ...prev,
                                    [collection.id]: nextDraft,
                                  }))
                                }
                                products={products}
                                productsById={productsById}
                                uploading={isUploading}
                                onUploadImage={(file) => handleEditUpload(collection.id, file)}
                              />

                              <DialogFooter>
                                <AdminButton
                                  type="button"
                                  variant="outline"
                                  onClick={() => setEditDialogCollectionId(null)}
                                  disabled={isSaving || isDeleting || isUploading}
                                >
                                  Zrušiť
                                </AdminButton>
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
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AdminButton
                            type="button"
                            variant="outline"
                            size="sm"
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
