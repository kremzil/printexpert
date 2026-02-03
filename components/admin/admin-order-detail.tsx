"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/print/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Send, Download } from "lucide-react";
import { toast } from "sonner";
import { getCsrfHeader } from "@/lib/csrf";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  width: number | null;
  height: number | null;
  priceGross: number;
  selectedOptions?: unknown;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  audience: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  items: OrderItem[];
  createdAt: Date;
  statusHistory: OrderStatusHistoryEntry[];
  stripeEvents: StripeEventEntry[];
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface AdminOrderDetailProps {
  order: Order;
}

interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  createdAt: string;
  note: string | null;
  changedByUser: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface StripeEventEntry {
  id: string;
  type: string;
  createdAt: string;
}

interface OrderAsset {
  id: string;
  kind: "ARTWORK" | "PREVIEW" | "INVOICE" | "OTHER";
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  fileNameOriginal: string;
  sizeBytes: number;
  createdAt: string;
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

const statusMap: Record<OrderStatus, { label: string }> = {
  PENDING: { label: "Čaká sa" },
  CONFIRMED: { label: "Potvrdená" },
  PROCESSING: { label: "Spracováva sa" },
  COMPLETED: { label: "Dokončená" },
  CANCELLED: { label: "Zrušená" },
};

const statusKeyMap = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

const assetStatusMap = {
  PENDING: { label: "Čaká sa", variant: "warning" as const },
  UPLOADED: { label: "Nahrané", variant: "success" as const },
  APPROVED: { label: "Schválené", variant: "success" as const },
  REJECTED: { label: "Odmietnuté", variant: "danger" as const },
};

const assetKindLabels = {
  ARTWORK: "Grafika",
  PREVIEW: "Náhľad",
  INVOICE: "Faktúra",
  OTHER: "Iné",
};

export function AdminOrderDetail({ order }: AdminOrderDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const formatHistoryDate = (date: string) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const formatEventDate = (date: string) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoadingAssets(true);
      const response = await fetch(`/api/orders/${order.id}/assets`);
      if (!response.ok) {
        throw new Error("Nepodarilo sa načítať súbory.");
      }
      const data = await response.json();
      setAssets(data.assets ?? []);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setIsLoadingAssets(false);
    }
  }, [order.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Nepodarilo sa aktualizovať status");
      }

      setStatus(newStatus);
      router.refresh();
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Chyba pri aktualizácii statusu");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendInvoice = async () => {
    setIsSendingInvoice(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/invoice/send`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodarilo sa odoslať faktúru");
      }

      const data = await response.json();
      toast.success(data.message ?? "Faktúra bola odoslaná");
      fetchAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa odoslať faktúru";
      toast.error(message);
    } finally {
      setIsSendingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <AdminButton asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </AdminButton>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Objednávka #{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={statusKeyMap[status]} size="lg" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Položky objednávky</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      {(item.width || item.height) && (
                        <p className="text-sm text-muted-foreground">
                          Rozmery: {item.width} × {item.height} cm
                        </p>
                      )}
                      {(() => {
                        const attributes = getSelectedOptionAttributes(item.selectedOptions);

                        if (!attributes || Object.keys(attributes).length === 0) {
                          return null;
                        }

                        return (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {Object.entries(attributes).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {value}
                            </div>
                          ))}
                        </div>
                        );
                      })()}
                      <p className="text-sm text-muted-foreground">
                        Množstvo: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(item.priceGross * item.quantity)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(item.priceGross)} / ks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontaktné údaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Meno: </span>
                <span>{order.customerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">E-mail: </span>
                <span>{order.customerEmail}</span>
              </div>
              {order.customerPhone && (
                <div>
                  <span className="text-muted-foreground">Telefón: </span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              {order.user && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Používateľský účet: </span>
                  <p className="mt-1">{order.user.email}</p>
                  {order.user.name && <p className="text-sm">{order.user.name}</p>}
                </div>
              )}
              {order.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Poznámka: </span>
                  <p className="mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Súbory k objednávke</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingAssets && (
                <p className="text-xs text-muted-foreground">Načítavam zoznam...</p>
              )}
              {!isLoadingAssets && assets.length === 0 && (
                <p className="text-xs text-muted-foreground">K objednávke nie sú priložené žiadne súbory.</p>
              )}
              {!isLoadingAssets && assets.length > 0 && (
                <div className="space-y-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{asset.fileNameOriginal}</p>
                        <p className="text-xs text-muted-foreground">
                          {assetKindLabels[asset.kind]} · {formatBytes(asset.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AdminBadge variant={assetStatusMap[asset.status].variant}>
                          {assetStatusMap[asset.status].label}
                        </AdminBadge>
                        <AdminButton asChild size="sm" variant="outline">
                          <a href={`/api/assets/${asset.id}/download`}>
                            Stiahnuť
                          </a>
                        </AdminButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>História stavu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.statusHistory.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Zatiaľ nebola zaznamenaná žiadna zmena stavu.
                </p>
              )}
              {order.statusHistory.length > 0 && (
                <div className="space-y-3">
                  {order.statusHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="font-medium">
                          {statusMap[entry.fromStatus].label} → {statusMap[entry.toStatus].label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatHistoryDate(entry.createdAt)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {entry.changedByUser
                          ? entry.changedByUser.name ?? entry.changedByUser.email
                          : "Systém"}
                      </div>
                      {entry.note && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {entry.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stripe udalosti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.stripeEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Zatiaľ neboli zaznamenané žiadne webhook udalosti.
                </p>
              )}
              {order.stripeEvents.length > 0 && (
                <div className="space-y-3">
                  {order.stripeEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="font-medium">{event.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatEventDate(event.createdAt)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground break-all">
                        {event.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Faktúra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <AdminButton asChild variant="outline" className="w-full">
                  <a href={`/api/orders/${order.id}/invoice`} target="_blank">
                    <Download className="mr-2 h-4 w-4" />
                    Stiahnuť faktúru
                  </a>
                </AdminButton>
                <AdminButton
                  variant="primary"
                  className="w-full"
                  onClick={handleSendInvoice}
                  disabled={isSendingInvoice}
                >
                  {isSendingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Odosielam...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Odoslať faktúru e-mailom
                    </>
                  )}
                </AdminButton>
              </div>
              <p className="text-xs text-muted-foreground">
                Faktúra bude odoslaná na: {order.customerEmail}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status objednávky</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Zmeniť status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => handleStatusChange(value as OrderStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Čaká sa</SelectItem>
                    <SelectItem value="CONFIRMED">Potvrdená</SelectItem>
                    <SelectItem value="PROCESSING">Spracováva sa</SelectItem>
                    <SelectItem value="COMPLETED">Dokončená</SelectItem>
                    <SelectItem value="CANCELLED">Zrušená</SelectItem>
                  </SelectContent>
                </Select>
                {isUpdating && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Aktualizujem...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Súhrn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medzisoučet</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DPH</span>
                  <span>{formatPrice(order.vatAmount)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-base">
                  <span>Celkom</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Režim: <span className="uppercase">{order.audience}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
