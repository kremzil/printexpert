"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminBadge } from "@/components/admin/admin-badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCsrfHeader } from "@/lib/csrf";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  priceGross: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerEmail: string;
  total: number;
  createdAt: Date;
  items: OrderItem[];
  user?: {
    email: string;
    name: string | null;
  } | null;
}

interface AdminOrdersListProps {
  orders: Order[];
}

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string; variant: "warning" | "default" | "success" | "inactive" }> = [
  { value: "PENDING", label: "Čaká sa", variant: "warning" },
  { value: "CONFIRMED", label: "Potvrdená", variant: "default" },
  { value: "PROCESSING", label: "Spracováva sa", variant: "default" },
  { value: "COMPLETED", label: "Dokončená", variant: "success" },
  { value: "CANCELLED", label: "Zrušená", variant: "inactive" },
];

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Nezaplatená",
  PENDING: "Čaká na platbu",
  PAID: "Zaplatená",
  FAILED: "Neúspešná",
  REFUNDED: "Refundovaná",
};

type ColumnKey = "order" | "customer" | "date" | "total" | "payment" | "status" | "actions";
const COLUMN_VISIBILITY_KEY = "admin:orders:columnVisibility:v1";
const DEFAULT_COLUMN_VISIBILITY: Record<ColumnKey, boolean> = {
  order: true,
  customer: true,
  date: true,
  total: true,
  payment: true,
  status: true,
  actions: true,
};
const COLUMN_LABELS: Record<ColumnKey, string> = {
  order: "Objednávka",
  customer: "Zákazník",
  date: "Dátum",
  total: "Suma",
  payment: "Platba",
  status: "Status",
  actions: "Akcie",
};
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function AdminOrdersList({ orders }: AdminOrdersListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickStatus, setQuickStatus] = useState<"all" | OrderStatus>("all");
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMN_VISIBILITY);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("PROCESSING");
  const [bulkNote, setBulkNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

  const filteredOrders = useMemo(() => {
    if (quickStatus === "all") return orders;
    return orders.filter((order) => order.status === quickStatus);
  }, [orders, quickStatus]);

  const orderIds = useMemo(() => filteredOrders.map((order) => order.id), [filteredOrders]);
  const pageCount = Math.max(Math.ceil(filteredOrders.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedOrders = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, pageSize, safePageIndex]);
  const currentPageIds = useMemo(() => paginatedOrders.map((order) => order.id), [paginatedOrders]);
  const selectedOnPageCount = useMemo(
    () => currentPageIds.filter((id) => selectedIds.includes(id)).length,
    [currentPageIds, selectedIds]
  );
  const allSelected = currentPageIds.length > 0 && selectedOnPageCount === currentPageIds.length;
  const someSelected = selectedOnPageCount > 0 && selectedOnPageCount < currentPageIds.length;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
      setColumnVisibility((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore malformed persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => orderIds.includes(id)));
  }, [orderIds]);
  useEffect(() => {
    if (pageIndex !== safePageIndex) {
      setPageIndex(safePageIndex);
    }
  }, [pageIndex, safePageIndex]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (!checked) {
        return prev.filter((id) => !currentPageIds.includes(id));
      }
      return Array.from(new Set([...prev, ...currentPageIds]));
    });
  };

  const toggleOne = (orderId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, orderId]));
      return prev.filter((id) => id !== orderId);
    });
  };

  const submitBulkStatus = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/orders/bulk-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          orderIds: selectedIds,
          status: bulkStatus,
          note: bulkNote.trim() ? bulkNote : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Bulk zmena stavu zlyhala.");
      }

      toast.success(`Aktualizované objednávky: ${data.changed ?? 0}`);
      setSelectedIds([]);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk zmena stavu zlyhala.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportCsv = () => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("format", "csv");
    if (quickStatus !== "all") {
      params.set("status", quickStatus);
    }
    window.location.href = `/api/admin/orders/export?${params.toString()}`;
  };

  const deleteOrder = async (orderId: string, orderNumber: string) => {
    const confirmed = window.confirm(
      `Naozaj chcete odstrániť objednávku #${orderNumber}?`
    );
    if (!confirmed) return;

    setDeletingOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          ...getCsrfHeader(),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Nepodarilo sa odstrániť objednávku.");
      }

      toast.success(`Objednávka #${orderNumber} bola odstránená.`);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodarilo sa odstrániť objednávku.");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const deleteSelectedOrders = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Naozaj chcete odstrániť vybrané objednávky (${selectedIds.length})?`
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/orders/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          orderIds: selectedIds,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Hromadné odstránenie objednávok zlyhalo.");
      }

      toast.success(`Odstránené objednávky: ${data.deleted ?? 0}`);
      setSelectedIds([]);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Hromadné odstránenie objednávok zlyhalo."
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-muted-foreground">Zatiaľ nie sú žiadne objednávky</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Záznamov: {filteredOrders.length} / {orders.length}</span>
          <div className="flex flex-wrap gap-1">
            <AdminButton
              size="sm"
              variant={quickStatus === "all" ? "primary" : "outline"}
              onClick={() => {
                setQuickStatus("all");
                setPageIndex(0);
              }}
            >
              Všetky
            </AdminButton>
            {STATUS_OPTIONS.map((option) => (
              <AdminButton
                key={option.value}
                size="sm"
                variant={quickStatus === option.value ? "primary" : "outline"}
                onClick={() => {
                  setQuickStatus(option.value);
                  setPageIndex(0);
                }}
              >
                {option.label}
              </AdminButton>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AdminButton size="sm" variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Stĺpce
              </AdminButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Zobraziť stĺpce</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(DEFAULT_COLUMN_VISIBILITY) as ColumnKey[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={columnVisibility[key]}
                  onCheckedChange={(checked) =>
                    setColumnVisibility((prev) => ({ ...prev, [key]: !!checked }))
                  }
                >
                  {COLUMN_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AdminButton size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </AdminButton>
          <AdminButton size="sm" variant="outline" disabled title="Čoskoro dostupné">
            Export XLS (čoskoro)
          </AdminButton>
          <AdminButton size="sm" variant="outline" disabled title="Čoskoro dostupné">
            Export PDF (čoskoro)
          </AdminButton>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Pre zvolený filter sa nenašli žiadne objednávky.
          </CardContent>
        </Card>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-sm font-medium">Vybrané objednávky: {selectedIds.length}</div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            className="w-80"
            placeholder="Poznámka do histórie statusu (voliteľné)"
            value={bulkNote}
            onChange={(event) => setBulkNote(event.target.value)}
          />
          <AdminButton size="sm" onClick={submitBulkStatus} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aktualizovať status
          </AdminButton>
          <AdminButton
            size="sm"
            variant="danger"
            onClick={deleteSelectedOrders}
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Odstrániť vybrané
          </AdminButton>
        </div>
      ) : null}

      <div className="table-responsive rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2">
                <Checkbox
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={(value) => toggleAll(!!value)}
                  aria-label="Vybrať všetky objednávky"
                />
              </th>
              {columnVisibility.order ? <th className="px-3 py-2 font-medium">Objednávka</th> : null}
              {columnVisibility.customer ? <th className="px-3 py-2 font-medium">Zákazník</th> : null}
              {columnVisibility.date ? <th className="px-3 py-2 font-medium">Dátum</th> : null}
              {columnVisibility.total ? <th className="px-3 py-2 font-medium">Suma</th> : null}
              {columnVisibility.payment ? <th className="px-3 py-2 font-medium">Platba</th> : null}
              {columnVisibility.status ? <th className="px-3 py-2 font-medium">Status</th> : null}
              {columnVisibility.actions ? <th className="px-3 py-2 text-right font-medium">Akcie</th> : null}
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order) => {
              const statusMeta = STATUS_OPTIONS.find((item) => item.value === order.status);
              const selected = selectedIds.includes(order.id);
              return (
                <tr key={order.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(value) => toggleOne(order.id, !!value)}
                      aria-label={`Vybrať objednávku ${order.orderNumber}`}
                    />
                  </td>
                  {columnVisibility.order ? <td className="px-3 py-2 font-medium">#{order.orderNumber}</td> : null}
                  {columnVisibility.customer ? (
                    <td className="px-3 py-2">
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                    </td>
                  ) : null}
                  {columnVisibility.date ? (
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  ) : null}
                  {columnVisibility.total ? (
                    <td className="px-3 py-2 font-semibold">{order.total.toFixed(2)} €</td>
                  ) : null}
                  {columnVisibility.payment ? (
                    <td className="px-3 py-2 text-muted-foreground">{PAYMENT_LABELS[order.paymentStatus]}</td>
                  ) : null}
                  {columnVisibility.status ? (
                    <td className="px-3 py-2">
                      <AdminBadge variant={statusMeta?.variant ?? "default"} size="sm">
                        {statusMeta?.label ?? order.status}
                      </AdminBadge>
                    </td>
                  ) : null}
                  {columnVisibility.actions ? (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <AdminButton asChild size="sm" variant="outline">
                          <Link href={`/admin/orders/${order.id}`}>Detail</Link>
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="danger"
                          onClick={() => deleteOrder(order.id, order.orderNumber)}
                          disabled={deletingOrderId === order.id}
                        >
                          {deletingOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </AdminButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <div className="text-sm text-muted-foreground">{filteredOrders.length} objednávok celkom</div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Počet na stránku</label>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={String(pageSize)}
            onChange={(event) => {
              const nextSize = Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number];
              if (!PAGE_SIZE_OPTIONS.includes(nextSize)) return;
              setPageSize(nextSize);
              setPageIndex(0);
            }}
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
            onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
            disabled={safePageIndex <= 0}
          >
            Späť
          </AdminButton>
          <div className="text-sm text-muted-foreground">
            {safePageIndex + 1} / {pageCount}
          </div>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))}
            disabled={safePageIndex >= pageCount - 1}
          >
            Ďalej
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
