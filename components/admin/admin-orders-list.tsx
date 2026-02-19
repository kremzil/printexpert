"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
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

export function AdminOrdersList({ orders }: AdminOrdersListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickStatus, setQuickStatus] = useState<"all" | OrderStatus>("all");
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMN_VISIBILITY);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("PROCESSING");
  const [bulkNote, setBulkNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredOrders = useMemo(() => {
    if (quickStatus === "all") return orders;
    return orders.filter((order) => order.status === quickStatus);
  }, [orders, quickStatus]);

  const orderIds = useMemo(() => filteredOrders.map((order) => order.id), [filteredOrders]);
  const allSelected = orderIds.length > 0 && selectedIds.length === orderIds.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < orderIds.length;

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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? [...orderIds] : []);
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
              onClick={() => setQuickStatus("all")}
            >
              Všetky
            </AdminButton>
            {STATUS_OPTIONS.map((option) => (
              <AdminButton
                key={option.value}
                size="sm"
                variant={quickStatus === option.value ? "primary" : "outline"}
                onClick={() => setQuickStatus(option.value)}
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
            {filteredOrders.map((order) => {
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
                      <AdminButton asChild size="sm" variant="outline">
                        <Link href={`/admin/orders/${order.id}`}>Detail</Link>
                      </AdminButton>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
