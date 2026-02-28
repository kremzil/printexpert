"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowUpDown, Download, Eye, Filter, MoreHorizontal, Trash, Edit, Copy, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/utils";
import { getCsrfHeader } from "@/lib/csrf";
import { resolveProductImageUrl } from "@/lib/image-url";

type AdminProductItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  showInB2b: boolean;
  showInB2c: boolean;
  priceFrom: string | null;
  vatRate: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  images?: {
    url: string;
    alt: string | null;
  }[];
  _count?: {
    orderItems: number;
  };
};

type AdminProductsListProps = {
  products: AdminProductItem[];
};

const STORAGE_KEY_VISIBILITY = "admin:products:columnVisibility:v2";
const STORAGE_KEY_SAVED_VIEWS = "admin:products:savedViews:v1";
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const VIRTUAL_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN = 6;

type SavedView = {
  id: string;
  name: string;
  query: string;
  category: string;
  status: string;
  sort: SortingState;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  columnVisibility: VisibilityState;
};

const parseSortParam = (value: string | null): SortingState => {
  if (!value) return [];
  const [id, direction] = value.split(":");
  if (!id) return [];
  return [{ id, desc: direction === "desc" }];
};

const parseColumnFilters = (searchParams: URLSearchParams): ColumnFiltersState => {
  const filters: ColumnFiltersState = [];
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  if (category && category !== "all") {
    filters.push({ id: "category", value: category });
  }
  if (status && status !== "all") {
    filters.push({ id: "isActive", value: status });
  }
  return filters;
};

const getPinningStyles = (column: Column<AdminProductItem>) => {
  const pinned = column.getIsPinned();
  if (!pinned) return {};

  return {
    position: "sticky" as const,
    left: `${column.getStart("left")}px`,
    zIndex: 12,
    backgroundColor: "hsl(var(--card))",
  };
};

export function AdminProductsList({ products }: AdminProductsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const initialQuery = searchParams.get("q") ?? "";
  const initialPage = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const initialPageSize = PAGE_SIZE_OPTIONS.includes(
    Number(searchParams.get("pageSize") ?? "25") as (typeof PAGE_SIZE_OPTIONS)[number]
  )
    ? (Number(searchParams.get("pageSize") ?? "25") as (typeof PAGE_SIZE_OPTIONS)[number])
    : 25;

  const [sorting, setSorting] = useState<SortingState>(() => parseSortParam(searchParams.get("sort")));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => parseColumnFilters(searchParams));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState(initialQuery);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: initialPage - 1,
    pageSize: initialPageSize,
  });
  const [columnPinning] = useState<ColumnPinningState>({
    left: ["select", "images", "name", "category"],
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState("default");
  const [isBulkPending, setIsBulkPending] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(520);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VISIBILITY);
      if (raw) {
        const parsed = JSON.parse(raw) as VisibilityState;
        setColumnVisibility(parsed);
      }
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_VIEWS);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedView[];
      if (!Array.isArray(parsed)) return;
      setSavedViews(parsed);
    } catch {
      // ignore invalid persisted saved views
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED_VIEWS, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    setContainerHeight(container.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect.height;
      if (!nextHeight) return;
      setContainerHeight(nextHeight);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => {
      if (product.category?.slug && product.category?.name) {
        map.set(product.category.slug, product.category.name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    for (const product of products) {
      suggestions.add(product.name);
      suggestions.add(product.slug);
    }
    return Array.from(suggestions).slice(0, 80);
  }, [products]);

  const bulkCategoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => {
      if (product.category?.name) {
        map.set(product.category.id, product.category.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const setSingleFilter = (id: string, value?: string) => {
    setColumnFilters((prev) => {
      const without = prev.filter((item) => item.id !== id);
      if (!value || value === "all") return without;
      return [...without, { id, value }];
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const getCurrentViewSnapshot = () => {
    const categoryValue =
      (columnFilters.find((item) => item.id === "category")?.value as string | undefined) ?? "all";
    const statusValue =
      (columnFilters.find((item) => item.id === "isActive")?.value as string | undefined) ?? "all";

    return {
      query: globalFilter,
      category: categoryValue,
      status: statusValue,
      sort: sorting,
      pageSize: pagination.pageSize as (typeof PAGE_SIZE_OPTIONS)[number],
      columnVisibility,
    };
  };

  const applyView = (view: SavedView | null) => {
    if (!view) {
      setGlobalFilter("");
      setColumnFilters([]);
      setSorting([]);
      setPagination((prev) => ({ ...prev, pageIndex: 0, pageSize: 25 }));
      setActiveViewId("default");
      return;
    }

    const nextFilters: ColumnFiltersState = [];
    if (view.category && view.category !== "all") {
      nextFilters.push({ id: "category", value: view.category });
    }
    if (view.status && view.status !== "all") {
      nextFilters.push({ id: "isActive", value: view.status });
    }

    setGlobalFilter(view.query ?? "");
    setColumnFilters(nextFilters);
    setSorting(Array.isArray(view.sort) ? view.sort : []);
    setPagination((prev) => ({ ...prev, pageIndex: 0, pageSize: view.pageSize ?? 25 }));
    setColumnVisibility(view.columnVisibility ?? {});
    setActiveViewId(view.id);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Názov pohľadu");
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();
    const snapshot = getCurrentViewSnapshot();
    const id = `view-${Date.now()}`;
    const nextView: SavedView = {
      id,
      name: trimmedName,
      ...snapshot,
    };
    setSavedViews((prev) => [nextView, ...prev].slice(0, 10));
    setActiveViewId(id);
    toast.success("Pohľad bol uložený.");
  };

  const columns = useMemo<ColumnDef<AdminProductItem>[]>(() => {
    return [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        size: 40,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Vybrať všetko"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Vybrať produkt ${row.original.name}`}
          />
        ),
      },
      {
        accessorKey: "images",
        header: "Obrázok",
        size: 92,
        cell: ({ row }) => {
          const image = row.original.images?.[0];
          const imageUrl = resolveProductImageUrl(image?.url);
          return (
            <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
              {image && imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={image.alt || row.original.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  Bez foto
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        size: 260,
        header: ({ column }) => (
          <AdminButton variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Názov
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </AdminButton>
        ),
        cell: ({ row }) => (
          <div>
            <Link href={`/admin/products/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
            <div className="text-xs text-muted-foreground">/{row.original.slug}</div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Kategória",
        size: 170,
        filterFn: (row, _id, value) => {
          if (!value || value === "all") return true;
          if (value === "none") return !row.original.category;
          return row.original.category?.slug === value;
        },
        cell: ({ row }) => (
          <AdminBadge variant="default" size="sm">
            {row.original.category?.name ?? "Bez kategórie"}
          </AdminBadge>
        ),
      },
      {
        accessorKey: "priceFrom",
        header: "Cena od",
        size: 120,
        cell: ({ row }) =>
          row.original.priceFrom ? (
            <div className="font-mono text-sm">{formatPrice(Number(row.original.priceFrom))}</div>
          ) : (
            <span className="text-xs text-muted-foreground">Na vyžiadanie</span>
          ),
      },
      {
        accessorKey: "isActive",
        header: "Viditeľnosť",
        size: 190,
        filterFn: (row, _id, value) => {
          if (!value || value === "all") return true;
          if (value === "active") return row.original.isActive;
          if (value === "inactive") return !row.original.isActive;
          return true;
        },
        cell: ({ row }) => {
          const { isActive, showInB2b, showInB2c } = row.original;
          if (!isActive) return <AdminBadge variant="inactive">Neaktívny</AdminBadge>;
          return (
            <div className="flex flex-wrap gap-1">
              {showInB2b ? <AdminBadge variant="b2b" size="sm">B2B</AdminBadge> : null}
              {showInB2c ? <AdminBadge variant="b2c" size="sm">B2C</AdminBadge> : null}
              {!showInB2b && !showInB2c ? <AdminBadge size="sm">Skrytý</AdminBadge> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "_count.orderItems",
        id: "orderItems",
        header: ({ column }) => (
          <AdminButton variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Objednané
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </AdminButton>
        ),
        size: 120,
        cell: ({ row }) => <div className="text-center">{row.original._count?.orderItems ?? 0}x</div>,
      },
      {
        id: "actions",
        enableHiding: false,
        size: 96,
        cell: ({ row }) => (
          <ProductActions
            product={row.original}
            onDelete={async () => {
              await runProductBulkAction("delete", [row.original.id], undefined, undefined);
            }}
            onAddedToTop={(message) => toast.success(message)}
          />
        ),
      },
    ];
  }, []);

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnPinning,
      globalFilter,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    enableColumnPinning: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onSortingChange: (value) => {
      setSorting(typeof value === "function" ? value(sorting) : value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(String(value));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? "").trim().toLowerCase();
      if (!query) return true;
      return (
        row.original.name.toLowerCase().includes(query) ||
        row.original.slug.toLowerCase().includes(query) ||
        (row.original.category?.name ?? "").toLowerCase().includes(query)
      );
    },
  });

  const pageRows = table.getRowModel().rows;
  const shouldVirtualize = pageRows.length > 35;
  const estimatedRowsInView = Math.ceil(containerHeight / VIRTUAL_ROW_HEIGHT);
  const visibleCount = estimatedRowsInView + VIRTUAL_OVERSCAN * 2;
  const virtualStart = shouldVirtualize
    ? Math.max(Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN, 0)
    : 0;
  const virtualEnd = shouldVirtualize ? Math.min(virtualStart + visibleCount, pageRows.length) : pageRows.length;
  const visibleRows = shouldVirtualize ? pageRows.slice(virtualStart, virtualEnd) : pageRows;
  const topPaddingHeight = shouldVirtualize ? virtualStart * VIRTUAL_ROW_HEIGHT : 0;
  const bottomPaddingHeight = shouldVirtualize ? Math.max((pageRows.length - virtualEnd) * VIRTUAL_ROW_HEIGHT, 0) : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new URLSearchParams(window.location.search);
    const categoryValue = (columnFilters.find((item) => item.id === "category")?.value as string | undefined) ?? "all";
    const statusValue = (columnFilters.find((item) => item.id === "isActive")?.value as string | undefined) ?? "all";
    const sortValue = sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "";

    if (globalFilter) next.set("q", globalFilter);
    else next.delete("q");
    if (categoryValue !== "all") next.set("category", categoryValue);
    else next.delete("category");
    if (statusValue !== "all") next.set("status", statusValue);
    else next.delete("status");
    if (sortValue) next.set("sort", sortValue);
    else next.delete("sort");
    next.set("page", String(pagination.pageIndex + 1));
    next.set("pageSize", String(pagination.pageSize));

    const current = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    const nextValue = next.toString();
    if (nextValue !== current) {
      router.replace(`/admin/products?${nextValue}`, { scroll: false });
    }
  }, [columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, router, sorting]);

  useEffect(() => {
    setScrollTop(0);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [pagination.pageIndex, pagination.pageSize, globalFilter, columnFilters, sorting]);

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
  const selectedCount = selectedIds.length;

  const handleBulkVisibility = async (visibility: { isActive?: boolean; showInB2b?: boolean; showInB2c?: boolean }) => {
    if (selectedIds.length === 0) return;
    setIsBulkPending(true);
    try {
      const response = await runProductBulkAction("setVisibility", selectedIds, undefined, visibility);
      toast.success(`Aktualizovaných: ${response.updated ?? 0}`);
      setRowSelection({});
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk akcia zlyhala.");
    } finally {
      setIsBulkPending(false);
    }
  };

  const handleBulkCategory = async () => {
    if (!bulkCategoryId || selectedIds.length === 0) return;
    setIsBulkPending(true);
    try {
      const response = await runProductBulkAction("setCategory", selectedIds, bulkCategoryId, undefined);
      toast.success(`Presunutých do kategórie: ${response.updated ?? 0}`);
      setRowSelection({});
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk akcia zlyhala.");
    } finally {
      setIsBulkPending(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm("Naozaj chcete odstrániť vybrané produkty?");
    if (!confirmed) return;
    setIsBulkPending(true);
    try {
      const response = await runProductBulkAction("delete", selectedIds, undefined, undefined);
      toast.success(`Odstránené: ${response.deleted ?? 0}, deaktivované: ${response.deactivated ?? 0}`);
      setRowSelection({});
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk akcia zlyhala.");
    } finally {
      setIsBulkPending(false);
    }
  };

  const triggerExport = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    params.set(
      "columns",
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .join(",")
    );
    window.location.href = `/api/admin/products/export?${params.toString()}`;
  };

  const categoryFilterValue =
    (columnFilters.find((item) => item.id === "category")?.value as string | undefined) ?? "all";
  const statusFilterValue =
    (columnFilters.find((item) => item.id === "isActive")?.value as string | undefined) ?? "all";

  return (
    <div className="w-full space-y-4">
      <div className="sticky top-16 z-20 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={activeViewId}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "default") {
                  applyView(null);
                  return;
                }
                const view = savedViews.find((item) => item.id === value) ?? null;
                applyView(view);
              }}
            >
              <option value="default">Predvolený pohľad</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <AdminButton type="button" variant="outline" size="sm" onClick={saveCurrentView}>
              Uložiť pohľad
            </AdminButton>
            <Input
              placeholder="Hľadať produkty…"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="w-72"
              list="admin-products-suggestions"
            />
            <datalist id="admin-products-suggestions">
              {searchSuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Kategória
                </AdminButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filtrovanie podľa kategórie</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={categoryFilterValue === "all"}
                  onCheckedChange={() => setSingleFilter("category", "all")}
                >
                  Všetky kategórie
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={categoryFilterValue === "none"}
                  onCheckedChange={(checked) => setSingleFilter("category", checked ? "none" : "all")}
                >
                  Bez kategórie
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {categoryOptions.map(([slug, name]) => (
                  <DropdownMenuCheckboxItem
                    key={slug}
                    checked={categoryFilterValue === slug}
                    onCheckedChange={(checked) => setSingleFilter("category", checked ? slug : "all")}
                  >
                    {name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Stav
                </AdminButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filtrovanie podľa stavu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={statusFilterValue === "all"}
                  onCheckedChange={() => setSingleFilter("isActive", "all")}
                >
                  Všetky stavy
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilterValue === "active"}
                  onCheckedChange={(checked) => setSingleFilter("isActive", checked ? "active" : "all")}
                >
                  Aktívne
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilterValue === "inactive"}
                  onCheckedChange={(checked) => setSingleFilter("isActive", checked ? "inactive" : "all")}
                >
                  Neaktívne
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  Stĺpce
                </AdminButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Zobraziť stĺpce</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <AdminButton variant="outline" size="sm" onClick={triggerExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </AdminButton>
            <AdminButton variant="outline" size="sm" disabled title="Čoskoro dostupné">
              Export XLS (čoskoro)
            </AdminButton>
            <AdminButton variant="outline" size="sm" disabled title="Čoskoro dostupné">
              Export PDF (čoskoro)
            </AdminButton>
          </div>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-sm font-medium">Vybrané: {selectedCount}</div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={bulkCategoryId}
            onChange={(event) => setBulkCategoryId(event.target.value)}
          >
            <option value="">Kategória…</option>
            {bulkCategoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <AdminButton size="sm" variant="outline" onClick={handleBulkCategory} disabled={!bulkCategoryId || isBulkPending}>
            Presunúť kategóriu
          </AdminButton>
          <AdminButton
            size="sm"
            variant="outline"
            onClick={() => handleBulkVisibility({ isActive: true, showInB2b: true, showInB2c: true })}
            disabled={isBulkPending}
          >
            Zviditeľniť
          </AdminButton>
          <AdminButton
            size="sm"
            variant="outline"
            onClick={() => handleBulkVisibility({ isActive: false, showInB2b: false, showInB2c: false })}
            disabled={isBulkPending}
          >
            Skryť
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={handleBulkDelete} disabled={isBulkPending}>
            {isBulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
            Odstrániť
          </AdminButton>
        </div>
      ) : null}

      <div
        ref={tableContainerRef}
        className="max-h-[68vh] overflow-auto rounded-md border"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      ...getPinningStyles(header.column),
                    }}
                    className={header.column.getIsPinned() ? "shadow-[1px_0_0_hsl(var(--border))]" : undefined}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="relative flex items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() ? (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-border/50 opacity-0 transition-opacity hover:opacity-100"
                          />
                        ) : null}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length > 0 ? (
              <>
                {topPaddingHeight > 0 ? (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={table.getAllColumns().length} style={{ height: topPaddingHeight, padding: 0 }} />
                  </TableRow>
                ) : null}
                {visibleRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={getPinningStyles(cell.column)}
                      className={cell.column.getIsPinned() ? "shadow-[1px_0_0_hsl(var(--border))]" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                ))}
                {bottomPaddingHeight > 0 ? (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={table.getAllColumns().length} style={{ height: bottomPaddingHeight, padding: 0 }} />
                  </TableRow>
                ) : null}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  Žiadne produkty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} produktov celkom</div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Počet na stránku</label>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={String(pagination.pageSize)}
            onChange={(event) =>
              setPagination({ pageIndex: 0, pageSize: Number(event.target.value) || pagination.pageSize })
            }
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Späť
          </AdminButton>
          <div className="text-sm text-muted-foreground">
            {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </div>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Ďalej
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

async function runProductBulkAction(
  action: "setCategory" | "setVisibility" | "delete",
  productIds: string[],
  categoryId?: string,
  visibility?: { isActive?: boolean; showInB2b?: boolean; showInB2c?: boolean }
) {
  const payload: {
    action: "setCategory" | "setVisibility" | "delete";
    productIds: string[];
    categoryId?: string;
    visibility?: { isActive?: boolean; showInB2b?: boolean; showInB2c?: boolean };
  } = {
    action,
    productIds,
  };
  if (categoryId) payload.categoryId = categoryId;
  if (visibility) payload.visibility = visibility;

  const response = await fetch("/api/admin/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getCsrfHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Nepodarilo sa vykonať bulk akciu.");
  }
  return (await response.json()) as Record<string, number>;
}

function ProductActions({
  product,
  onDelete,
  onAddedToTop,
}: {
  product: AdminProductItem;
  onDelete: () => Promise<void>;
  onAddedToTop: (message: string) => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/product/${product.slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Odkaz bol skopírovaný.");
  };

  const addToTopProducts = async (audience: "b2b" | "b2c") => {
    setIsPending(true);
    try {
      const currentRes = await fetch(`/api/admin/top-products?audience=${audience}`);
      const current = (await currentRes.json().catch(() => ({}))) as { productIds?: string[] };
      const currentIds = Array.isArray(current.productIds) ? current.productIds : [];
      const nextIds = Array.from(new Set([product.id, ...currentIds])).slice(0, 8);

      const saveRes = await fetch("/api/admin/top-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          audience,
          mode: "MANUAL",
          productIds: nextIds,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodarilo sa uložiť top produkty.");
      }

      onAddedToTop(`Produkt bol pridaný do Top produktov (${audience.toUpperCase()}).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akcia zlyhala.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AdminButton variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Otvoriť menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </AdminButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Akcie</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/product/${product.slug}`} target="_blank">
            <Eye className="mr-2 h-4 w-4" />
            Zobraziť na webe
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/products/${product.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Upraviť
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); copyLink(); }}>
          <Copy className="mr-2 h-4 w-4" />
          Kopírovať odkaz
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            addToTopProducts("b2c");
          }}
        >
          <Star className="mr-2 h-4 w-4" />
          Pridať do Top (B2C)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            addToTopProducts("b2b");
          }}
        >
          <Star className="mr-2 h-4 w-4" />
          Pridať do Top (B2B)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async (event) => {
            event.preventDefault();
            const confirmed = window.confirm("Naozaj chcete produkt odstrániť?");
            if (!confirmed) return;
            await onDelete();
            toast.success("Produkt bol spracovaný v bulk odstránení.");
          }}
        >
          <Trash className="mr-2 h-4 w-4" />
          Odstrániť
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
