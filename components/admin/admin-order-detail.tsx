"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/print/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Send, Download, FilePlus, Printer } from "lucide-react";
import { toast } from "sonner";
import { getCsrfHeader } from "@/lib/csrf";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";

interface OrderItem {
  id: string;
  productName: string;
  productPriceType?: "ON_REQUEST" | "FIXED" | "MATRIX" | "AREA" | null;
  quantity: number;
  width: number | null;
  height: number | null;
  priceGross: number;
  selectedOptions?: unknown;
  designData?: unknown;
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
  deliveryMethod?: "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP" | null;
  paymentMethod?: "STRIPE" | "BANK_TRANSFER" | "COD" | null;
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  pickupPoint?: unknown;
  carrier?: string | null;
  carrierShipmentId?: string | null;
  carrierParcelNumbers?: string[];
  carrierLabelLastPrintedAt?: string | null;
  carrierMeta?: unknown;
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

type PanelFeedback = {
  tone: "idle" | "loading" | "success" | "error";
  message: string;
};

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

const paymentStatusLabels = {
  UNPAID: "Nezaplatená",
  PENDING: "Čaká na platbu",
  PAID: "Zaplatená",
  FAILED: "Neúspešná",
  REFUNDED: "Refundovaná",
} as const;

const hasDpdLabelUrlInMeta = (meta: unknown) => {
  if (!meta || typeof meta !== "object") return false;
  const value = (
    meta as {
      result?: {
        result?: Array<{ label?: unknown }>;
      };
    }
  )?.result?.result?.[0]?.label;
  return typeof value === "string" && value.length > 0;
};

function PanelStatus({ feedback }: { feedback: PanelFeedback }) {
  const toneClass =
    feedback.tone === "error"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : feedback.tone === "success"
        ? "border-emerald-300/50 bg-emerald-50 text-emerald-900"
        : feedback.tone === "loading"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border bg-muted/20 text-muted-foreground";

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${toneClass}`}>
      <span className="inline-flex items-center gap-2">
        {feedback.tone === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {feedback.message}
      </span>
    </div>
  );
}

export function AdminOrderDetail({ order }: AdminOrderDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"items" | "customer" | "files" | "history" | "shipping" | "events">("items");
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [statusNote, setStatusNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsUpdatedAt, setAssetsUpdatedAt] = useState<string | null>(null);
  const [filesFeedback, setFilesFeedback] = useState<PanelFeedback>({
    tone: "idle",
    message: "Súbory pripravené.",
  });
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [isCancellingShipment, setIsCancellingShipment] = useState(false);
  const [dpdFeedback, setDpdFeedback] = useState<PanelFeedback>(
    order.carrierShipmentId
      ? { tone: "idle", message: "DPD zásielka je vytvorená." }
      : { tone: "idle", message: "DPD zásielka ešte nie je vytvorená." }
  );
  const canPrintLabels =
    Boolean(order.carrierParcelNumbers?.length) || hasDpdLabelUrlInMeta(order.carrierMeta);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const resolveItemPrices = (item: OrderItem) => {
    const isPerUnit = item.productPriceType === "FIXED";
    const safeQuantity = item.quantity > 0 ? item.quantity : 1;
    const lineTotal = isPerUnit ? item.priceGross * safeQuantity : item.priceGross;
    const unitPrice = lineTotal / safeQuantity;

    return { lineTotal, unitPrice };
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
      setAssetsError(null);
      setFilesFeedback({ tone: "loading", message: "Načítavam súbory objednávky..." });
      const response = await fetch(`/api/orders/${order.id}/assets`);
      if (!response.ok) {
        throw new Error("Nepodarilo sa načítať súbory.");
      }
      const data = await response.json();
      setAssets(data.assets ?? []);
      setAssetsUpdatedAt(new Date().toISOString());
      setFilesFeedback({
        tone: "success",
        message: `Súbory aktualizované (${Array.isArray(data.assets) ? data.assets.length : 0}).`,
      });
    } catch (error) {
      console.error("Failed to load assets:", error);
      const message = error instanceof Error ? error.message : "Nepodarilo sa načítať súbory.";
      setAssetsError(message);
      setFilesFeedback({ tone: "error", message });
    } finally {
      setIsLoadingAssets(false);
    }
  }, [order.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const hasInvoiceAsset = assets.some((asset) => asset.kind === "INVOICE");

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ status: newStatus, note: statusNote.trim() || undefined }),
      });

      if (!response.ok) {
        throw new Error("Nepodarilo sa aktualizovať status");
      }

      setStatus(newStatus);
      setStatusNote("");
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
        headers: { ...getCsrfHeader() },
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

  const handleCreateInvoice = async () => {
    setIsCreatingInvoice(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/invoice/create`, {
        method: "POST",
        headers: { ...getCsrfHeader() },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodarilo sa vytvoriť faktúru");
      }

      const data = await response.json();
      toast.success(data.message ?? "Faktúra bola vygenerovaná");
      fetchAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa vytvoriť faktúru";
      toast.error(message);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCreateShipment = async () => {
    setIsCreatingShipment(true);
    setDpdFeedback({ tone: "loading", message: "Vytváram DPD zásielku..." });
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/dpd/shipment`, {
        method: "POST",
        headers: { ...getCsrfHeader() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Nepodarilo sa vytvoriť DPD zásielku");
      toast.success("DPD zásielka bola vytvorená");
      setDpdFeedback({ tone: "success", message: "DPD zásielka bola vytvorená." });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "DPD chyba";
      toast.error(message);
      setDpdFeedback({ tone: "error", message });
    } finally {
      setIsCreatingShipment(false);
    }
  };

  const handlePrintLabels = async () => {
    setIsPrintingLabel(true);
    setDpdFeedback({ tone: "loading", message: "Generujem DPD štítky..." });
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/dpd/labels`, {
        method: "POST",
        headers: { ...getCsrfHeader() },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodarilo sa vygenerovať štítky");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dpd-labels-${order.orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Štítky boli pripravené na stiahnutie");
      setDpdFeedback({ tone: "success", message: "DPD štítky boli vygenerované." });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "DPD chyba";
      toast.error(message);
      setDpdFeedback({ tone: "error", message });
    } finally {
      setIsPrintingLabel(false);
    }
  };

  const handleCancelShipment = async () => {
    setIsCancellingShipment(true);
    setDpdFeedback({ tone: "loading", message: "Ruším DPD zásielku..." });
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/dpd/cancel`, {
        method: "POST",
        headers: { ...getCsrfHeader() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Nepodarilo sa zrušiť DPD zásielku");
      toast.success("DPD zásielka bola zrušená");
      setDpdFeedback({ tone: "success", message: "DPD zásielka bola zrušená." });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "DPD chyba";
      toast.error(message);
      setDpdFeedback({ tone: "error", message });
    } finally {
      setIsCancellingShipment(false);
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

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-5">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">{statusMap[status].label}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Celkom</p>
            <p className="mt-1 text-sm font-medium">{formatPrice(order.total)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Platba</p>
            <p className="mt-1 text-sm font-medium">
              {order.paymentStatus ? paymentStatusLabels[order.paymentStatus] : "Neznáma"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Vytvorená</p>
            <p className="mt-1 text-sm font-medium">{formatDate(order.createdAt)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">E-mail klienta</p>
            <p className="mt-1 text-sm font-medium break-all">{order.customerEmail}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "items" | "customer" | "files" | "history" | "shipping" | "events")
            }
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3 gap-2 md:grid-cols-6">
              <TabsTrigger value="items">Položky</TabsTrigger>
              <TabsTrigger value="customer">Klient</TabsTrigger>
              <TabsTrigger value="shipping">Doprava</TabsTrigger>
              <TabsTrigger value="files">Súbory</TabsTrigger>
              <TabsTrigger value="history">História</TabsTrigger>
              <TabsTrigger value="events">Udalosti</TabsTrigger>
            </TabsList>

            <TabsContent value="items">
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
                          {(item.width || item.height) ? (
                            <p className="text-sm text-muted-foreground">
                              Rozmery: {item.width} × {item.height} cm
                            </p>
                          ) : null}
                          {(() => {
                            const attributes = getSelectedOptionAttributes(item.selectedOptions);
                            if (!attributes || Object.keys(attributes).length === 0) return null;
                            return (
                              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                {Object.entries(attributes).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {value}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {Array.isArray(item.designData) ? (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-600">
                              Design Studio ({(item.designData as unknown[]).length} elementov)
                            </div>
                          ) : null}
                          <p className="text-sm text-muted-foreground">Množstvo: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          {(() => {
                            const { lineTotal, unitPrice } = resolveItemPrices(item);
                            return (
                              <>
                                <p className="font-semibold">{formatPrice(lineTotal)}</p>
                                <p className="text-sm text-muted-foreground">{formatPrice(unitPrice)} / ks</p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customer">
              <Card>
                <CardHeader>
                  <CardTitle>Klient a platba</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="text-muted-foreground">Meno: </span>{order.customerName}</div>
                  <div><span className="text-muted-foreground">E-mail: </span>{order.customerEmail}</div>
                  {order.customerPhone ? <div><span className="text-muted-foreground">Telefón: </span>{order.customerPhone}</div> : null}
                  <div><span className="text-muted-foreground">Platba: </span>{order.paymentMethod ?? "STRIPE"}</div>
                  {order.user ? (
                    <div className="border-t pt-2">
                      <span className="text-muted-foreground">Používateľský účet: </span>
                      <p className="mt-1">{order.user.email}</p>
                      {order.user.name ? <p>{order.user.name}</p> : null}
                    </div>
                  ) : null}
                  {order.notes ? (
                    <div className="border-t pt-2">
                      <span className="text-muted-foreground">Poznámka: </span>
                      <p className="mt-1">{order.notes}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipping">
              <Card>
                <CardHeader>
                  <CardTitle>Doprava a DPD</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Metóda doručenia: </span>
                    {order.deliveryMethod === "PERSONAL_PICKUP"
                      ? "Osobný odber - Rozvojová 2, Košice"
                      : order.deliveryMethod === "DPD_PICKUP"
                        ? "DPD Pickup/Pickup Station"
                        : "DPD kuriér"}
                  </p>
                  <p><span className="text-muted-foreground">Shipment ID: </span>{order.carrierShipmentId ?? "—"}</p>
                  <p><span className="text-muted-foreground">Parcely: </span>{order.carrierParcelNumbers?.join(", ") || "—"}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardHeader>
                  <CardTitle>Súbory k objednávke</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {assetsUpdatedAt
                        ? `Aktualizované: ${formatHistoryDate(assetsUpdatedAt)}`
                        : "Aktualizované: —"}
                    </p>
                    <AdminButton size="sm" variant="outline" onClick={fetchAssets} disabled={isLoadingAssets}>
                      {isLoadingAssets ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Načítavam...
                        </>
                      ) : (
                        "Obnoviť"
                      )}
                    </AdminButton>
                  </div>
                  <PanelStatus feedback={filesFeedback} />

                  {!isLoadingAssets && !assetsError && assets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">K objednávke nie sú priložené žiadne súbory.</p>
                  ) : null}
                  {!isLoadingAssets && !assetsError && assets.length > 0 ? (
                    <div className="space-y-3">
                      {assets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between gap-4 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{asset.fileNameOriginal}</p>
                            <p className="text-xs text-muted-foreground">
                              {assetKindLabels[asset.kind]} · {formatBytes(asset.sizeBytes)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <AdminBadge variant={assetStatusMap[asset.status].variant}>
                              {assetStatusMap[asset.status].label}
                            </AdminBadge>
                            <AdminButton asChild size="sm" variant="outline">
                              <a href={`/api/assets/${asset.id}/download`}>Stiahnuť</a>
                            </AdminButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>História stavu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.statusHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Zatiaľ nebola zaznamenaná žiadna zmena stavu.</p>
                  ) : (
                    <div className="space-y-3">
                      {order.statusHistory.map((entry) => (
                        <div key={entry.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div className="font-medium">
                              {statusMap[entry.fromStatus].label} → {statusMap[entry.toStatus].label}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatHistoryDate(entry.createdAt)}</div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {entry.changedByUser ? entry.changedByUser.name ?? entry.changedByUser.email : "Systém"}
                          </div>
                          {entry.note ? <div className="mt-1 text-xs text-muted-foreground">{entry.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Stripe udalosti</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.stripeEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Zatiaľ neboli zaznamenané žiadne webhook udalosti.</p>
                  ) : (
                    <div className="space-y-3">
                      {order.stripeEvents.map((event) => (
                        <div key={event.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div className="font-medium">{event.type}</div>
                            <div className="text-xs text-muted-foreground">{formatEventDate(event.createdAt)}</div>
                          </div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{event.id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateInvoice}
                  disabled={isCreatingInvoice || hasInvoiceAsset}
                >
                  {isCreatingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vytváram...
                    </>
                  ) : (
                    <>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Vytvoriť faktúru
                    </>
                  )}
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
              {hasInvoiceAsset && (
                <p className="text-xs text-muted-foreground">
                  Faktúra už bola vygenerovaná.
                </p>
              )}
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
                <div className="space-y-1">
                  <Label htmlFor="status-note">Poznámka do histórie</Label>
                  <Textarea
                    id="status-note"
                    placeholder="Voliteľná poznámka pri zmene statusu…"
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    rows={3}
                  />
                </div>
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
              <CardTitle>DPD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Doručenie:{" "}
                  {order.deliveryMethod === "PERSONAL_PICKUP"
                    ? "Osobný odber - Rozvojová 2, Košice"
                    : order.deliveryMethod === "DPD_PICKUP"
                      ? "DPD Pickup/Pickup Station"
                      : "DPD kuriér"}
                </p>
                <p>Platba: {order.paymentMethod ?? "STRIPE"}</p>
                <p>Shipment ID: {order.carrierShipmentId ?? "—"}</p>
                <p>Parcely: {order.carrierParcelNumbers?.join(", ") || "—"}</p>
              </div>
              <PanelStatus feedback={dpdFeedback} />
              <div className="flex flex-col gap-2">
                <AdminButton
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateShipment}
                  disabled={isCreatingShipment || Boolean(order.carrierShipmentId)}
                >
                  {isCreatingShipment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vytváram...
                    </>
                  ) : (
                    "Vytvoriť DPD zásielku"
                  )}
                </AdminButton>
                <AdminButton
                  variant="primary"
                  className="w-full"
                  onClick={handlePrintLabels}
                  disabled={isPrintingLabel || !canPrintLabels}
                >
                  {isPrintingLabel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generujem...
                    </>
                  ) : (
                    <>
                      <Printer className="mr-2 h-4 w-4" />
                      Tlačiť štítky
                    </>
                  )}
                </AdminButton>
                <AdminButton
                  variant="outline"
                  className="w-full"
                  onClick={handleCancelShipment}
                  disabled={isCancellingShipment || !(order.carrierParcelNumbers?.length)}
                >
                  {isCancellingShipment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ruším...
                    </>
                  ) : (
                    "Zrušiť DPD zásielku"
                  )}
                </AdminButton>
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
