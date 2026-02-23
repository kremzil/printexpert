"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Loader2, Send, Download, FilePlus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getCsrfHeader } from "@/lib/csrf";
import { getDesignElementCount } from "@/lib/design-studio";
import {
  OrderItemCatalogDialog,
  type CatalogDraftItem,
} from "@/components/admin/order-item-catalog-dialog";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productPriceType?: "ON_REQUEST" | "FIXED" | "MATRIX" | "AREA" | null;
  quantity: number;
  width: number | null;
  height: number | null;
  priceNet: number;
  priceVat: number;
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
  shippingAddress?: unknown;
  billingAddress?: unknown;
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
  orderItemId: string | null;
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

type InvoiceAddressForm = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  ico: string;
  dic: string;
  icDph: string;
};

type InvoiceEditForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: "STRIPE" | "BANK_TRANSFER" | "COD";
  deliveryMethod: "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP";
  billingAddress: InvoiceAddressForm;
  shippingAddress: InvoiceAddressForm;
};

type InvoiceItemDraft = {
  id: string;
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  width: string;
  height: string;
  selectedOptions?: unknown;
};

type InvoiceItemEditableField = "name" | "quantity" | "unitPrice" | "vatRate" | "width" | "height";

type InvoiceMetaForm = {
  invoicePrefix: string;
  invoiceNumber: string;
  issueDate: string;
  taxDate: string;
  dueDate: string;
};

type InvoiceMetaDefaults = {
  invoicePrefix: string;
  invoiceNextNumber: number;
  paymentDueDays: number;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};

const formatAddressLines = (address: unknown): string[] => {
  if (!isRecord(address)) return [];

  const firstName = toText(address.firstName);
  const lastName = toText(address.lastName);
  const fallbackName = toText(address.name);
  const company = toText(address.company) || toText(address.companyName);
  const address1 = toText(address.address1) || toText(address.street);
  const address2 = toText(address.address2);
  const city = toText(address.city);
  const postcode = toText(address.postcode) || toText(address.postalCode);
  const country = toText(address.country);
  const ico = toText(address.ico) || toText(address.billing_ico);
  const dic = toText(address.dic) || toText(address.billing_dic);
  const icDph =
    toText(address.icDph) ||
    toText(address.icdph) ||
    toText(address.ic_dph) ||
    toText(address.billing_icdph);

  const name = fallbackName || [firstName, lastName].filter(Boolean).join(" ").trim();
  const street = [address1, address2].filter(Boolean).join(", ").trim();
  const cityLine = [postcode, city].filter(Boolean).join(" ").trim();
  const lines = [
    name,
    company,
    street,
    cityLine,
    country,
    ico ? `IČO: ${ico}` : null,
    dic ? `DIČ: ${dic}` : null,
    icDph ? `IČ DPH: ${icDph}` : null,
  ].filter(Boolean) as string[];

  return lines;
};

const parseInvoiceAddress = (address: unknown): InvoiceAddressForm => {
  if (!isRecord(address)) {
    return {
      name: "",
      street: "",
      postalCode: "",
      city: "",
      country: "",
      ico: "",
      dic: "",
      icDph: "",
    };
  }

  const firstName = toText(address.firstName);
  const lastName = toText(address.lastName);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: toText(address.name) ?? combinedName,
    street: toText(address.street) ?? toText(address.address1) ?? "",
    postalCode: toText(address.postalCode) ?? toText(address.postcode) ?? "",
    city: toText(address.city) ?? "",
    country: toText(address.country) ?? "",
    ico: toText(address.ico) ?? toText(address.billing_ico) ?? "",
    dic: toText(address.dic) ?? toText(address.billing_dic) ?? "",
    icDph:
      toText(address.icDph) ??
      toText(address.icdph) ??
      toText(address.ic_dph) ??
      toText(address.billing_icdph) ??
      "",
  };
};

const buildInvoiceAddressPayload = (
  value: InvoiceAddressForm,
  includeTaxFields: boolean
): Record<string, string> | null => {
  const payload: Record<string, string> = {};

  const name = value.name.trim();
  const street = value.street.trim();
  const postalCode = value.postalCode.trim();
  const city = value.city.trim();
  const country = value.country.trim();

  if (name) payload.name = name;
  if (street) payload.street = street;
  if (postalCode) payload.postalCode = postalCode;
  if (city) payload.city = city;
  if (country) payload.country = country;

  if (includeTaxFields) {
    const ico = value.ico.trim();
    const dic = value.dic.trim();
    const icDph = value.icDph.trim();
    if (ico) payload.ico = ico;
    if (dic) payload.dic = dic;
    if (icDph) payload.icDph = icDph;
  }

  return Object.keys(payload).length > 0 ? payload : null;
};

const formatDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMoneyInput = (value: number): string => value.toFixed(2);

const buildInvoiceMetaFormFromDefaults = (defaults: InvoiceMetaDefaults): InvoiceMetaForm => {
  const issueDate = formatDateInputValue(new Date());
  const taxDate = issueDate;
  const dueDateValue = new Date();
  dueDateValue.setDate(dueDateValue.getDate() + (defaults.paymentDueDays || 14));

  return {
    invoicePrefix: defaults.invoicePrefix,
    invoiceNumber: "",
    issueDate,
    taxDate,
    dueDate: formatDateInputValue(dueDateValue),
  };
};

function AddressPreview({ value }: { value: unknown }) {
  if (!value) {
    return <p className="text-xs text-muted-foreground">—</p>;
  }

  const lines = formatAddressLines(value);
  if (lines.length > 0) {
    return (
      <div className="space-y-0.5 text-xs">
        {lines.map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  if (!value) {
    return <p className="text-xs text-muted-foreground">—</p>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-xs">{String(value)}</p>;
  }

  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

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
  const [isRegeneratingInvoice, setIsRegeneratingInvoice] = useState(false);
  const [isSavingInvoiceEdits, setIsSavingInvoiceEdits] = useState(false);
  const [isSavingOrderItems, setIsSavingOrderItems] = useState(false);
  const [isEditingShippingDetails, setIsEditingShippingDetails] = useState(false);
  const [isEditingInvoiceItems, setIsEditingInvoiceItems] = useState(false);
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [isEditingInvoiceMeta, setIsEditingInvoiceMeta] = useState(false);
  const [isLoadingInvoiceMetaDefaults, setIsLoadingInvoiceMetaDefaults] = useState(false);
  const [invoiceMetaDefaultsError, setInvoiceMetaDefaultsError] = useState<string | null>(null);
  const [invoiceMetaDefaults, setInvoiceMetaDefaults] = useState<InvoiceMetaDefaults>({
    invoicePrefix: "",
    invoiceNextNumber: 1,
    paymentDueDays: 14,
  });
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [isCancellingShipment, setIsCancellingShipment] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [dpdFeedback, setDpdFeedback] = useState<PanelFeedback>(
    order.carrierShipmentId
      ? { tone: "idle", message: "DPD zásielka je vytvorená." }
      : { tone: "idle", message: "DPD zásielka ešte nie je vytvorená." }
  );
  const canPrintLabels =
    Boolean(order.carrierParcelNumbers?.length) || hasDpdLabelUrlInMeta(order.carrierMeta);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceEditForm>({
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    paymentMethod: order.paymentMethod ?? "STRIPE",
    deliveryMethod: order.deliveryMethod ?? "DPD_COURIER",
    billingAddress: parseInvoiceAddress(order.billingAddress),
    shippingAddress: parseInvoiceAddress(order.shippingAddress),
  });
  const [invoiceItemsDraft, setInvoiceItemsDraft] = useState<InvoiceItemDraft[]>(() =>
    order.items.map((item, index) => {
      const safeQuantity = item.quantity > 0 ? item.quantity : 1;
      const unitPrice = item.priceNet / safeQuantity;
      const vatRate = item.priceNet > 0 ? (item.priceVat / item.priceNet) * 100 : 20;
      return {
        id: item.id || `item-${index}`,
        productId: item.productId,
        name: item.productName,
        quantity: String(safeQuantity),
        unitPrice: formatMoneyInput(unitPrice),
        vatRate: String(Math.round(vatRate * 100) / 100),
        width: item.width === null || item.width === undefined ? "" : String(item.width),
        height: item.height === null || item.height === undefined ? "" : String(item.height),
        selectedOptions: item.selectedOptions,
      };
    })
  );
  const [invoiceMetaForm, setInvoiceMetaForm] = useState<InvoiceMetaForm>(() =>
    buildInvoiceMetaFormFromDefaults({
      invoicePrefix: "",
      invoiceNextNumber: 1,
      paymentDueDays: 14,
    })
  );

  const resetInvoiceFormToOrder = () => {
    setInvoiceForm({
      customerName: order.customerName ?? "",
      customerEmail: order.customerEmail ?? "",
      customerPhone: order.customerPhone ?? "",
      paymentMethod: order.paymentMethod ?? "STRIPE",
      deliveryMethod: order.deliveryMethod ?? "DPD_COURIER",
      billingAddress: parseInvoiceAddress(order.billingAddress),
      shippingAddress: parseInvoiceAddress(order.shippingAddress),
    });
  };

  const resetInvoiceMetaForm = () => {
    setInvoiceMetaForm(buildInvoiceMetaFormFromDefaults(invoiceMetaDefaults));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const resolveItemPrices = (item: OrderItem) => {
    const safeQuantity = item.quantity > 0 ? item.quantity : 1;
    const lineTotal = item.priceGross;
    const unitPrice = lineTotal / safeQuantity;

    return { lineTotal, unitPrice };
  };

  const mapDeliveryMethodLabel = (value: Order["deliveryMethod"]) => {
    if (value === "PERSONAL_PICKUP") return "Osobný odber - Rozvojová 2, Košice";
    if (value === "DPD_PICKUP") return "DPD Pickup/Pickup Station";
    return "DPD kuriér";
  };

  const productsGrossTotal = order.items.reduce((sum, item) => sum + item.priceGross, 0);
  const shippingGrossTotal = Math.max(0, Math.round((order.total - productsGrossTotal) * 100) / 100);

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

  useEffect(() => {
    let isMounted = true;

    const loadInvoiceDefaults = async () => {
      setIsLoadingInvoiceMetaDefaults(true);
      setInvoiceMetaDefaultsError(null);

      try {
        const response = await fetch("/api/admin/settings/pdf");
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Nepodarilo sa načítať nastavenie faktúry."
          );
        }

        const parsedDefaults: InvoiceMetaDefaults = {
          invoicePrefix:
            typeof payload.invoicePrefix === "string" ? payload.invoicePrefix : "",
          invoiceNextNumber:
            typeof payload.invoiceNextNumber === "number" && Number.isFinite(payload.invoiceNextNumber)
              ? Math.max(1, Math.round(payload.invoiceNextNumber))
              : 1,
          paymentDueDays:
            typeof payload.paymentDueDays === "number" && Number.isFinite(payload.paymentDueDays)
              ? Math.max(1, Math.round(payload.paymentDueDays))
              : 14,
        };

        if (!isMounted) return;

        setInvoiceMetaDefaults(parsedDefaults);
        setInvoiceMetaForm((prev) => {
          if (isEditingInvoiceMeta) return prev;
          const next = buildInvoiceMetaFormFromDefaults(parsedDefaults);
          return {
            ...next,
            invoiceNumber: prev.invoiceNumber,
          };
        });
      } catch (error) {
        if (!isMounted) return;
        setInvoiceMetaDefaultsError(
          error instanceof Error ? error.message : "Nepodarilo sa načítať nastavenie faktúry."
        );
      } finally {
        if (isMounted) {
          setIsLoadingInvoiceMetaDefaults(false);
        }
      }
    };

    loadInvoiceDefaults();

    return () => {
      isMounted = false;
    };
  }, [isEditingInvoiceMeta]);

  const autoInvoiceNumberPreview = useMemo(() => {
    const currentPrefix = invoiceMetaForm.invoicePrefix.trim() || invoiceMetaDefaults.invoicePrefix;
    const sourceDate = new Date(invoiceMetaForm.issueDate);
    const baseDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
    const yearMonth = `${baseDate.getFullYear().toString().slice(-2)}${String(baseDate.getMonth() + 1).padStart(2, "0")}`;
    const formattedCounter = String(invoiceMetaDefaults.invoiceNextNumber).padStart(5, "0");
    return `${currentPrefix}${yearMonth} ${formattedCounter}`.trim();
  }, [
    invoiceMetaDefaults.invoiceNextNumber,
    invoiceMetaDefaults.invoicePrefix,
    invoiceMetaForm.invoicePrefix,
    invoiceMetaForm.issueDate,
  ]);

  const hasInvoiceAsset = assets.some((asset) => asset.kind === "INVOICE");
  const customerAssets = useMemo(
    () => assets.filter((asset) => asset.kind === "ARTWORK"),
    [assets]
  );
  const customerAssetsWithoutItem = useMemo(
    () => customerAssets.filter((asset) => !asset.orderItemId),
    [customerAssets]
  );
  const orderProductOptions = useMemo(
    () => {
      const productMap = new Map<string, string>();
      for (const item of order.items) {
        if (item.productId) {
          productMap.set(item.productId, item.productName);
        }
      }
      for (const item of invoiceItemsDraft) {
        const productId = item.productId?.trim();
        if (!productId) continue;
        const productName = item.name.trim() || productMap.get(productId) || "Produkt";
        productMap.set(productId, productName);
      }
      return Array.from(productMap.entries()).map(([productId, productName]) => ({
        productId,
        productName,
      }));
    },
    [order.items, invoiceItemsDraft]
  );

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

  const setInvoiceField = (
    field: keyof Pick<InvoiceEditForm, "customerName" | "customerEmail" | "customerPhone">
  ) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const setInvoiceAddressField = (
    addressField: "billingAddress" | "shippingAddress",
    field: keyof InvoiceAddressForm
  ) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInvoiceForm((prev) => ({
      ...prev,
      [addressField]: {
        ...prev[addressField],
        [field]: value,
      },
    }));
  };

  const setInvoiceItemField = (id: string, field: InvoiceItemEditableField) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInvoiceItemsDraft((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const setInvoiceItemProductId = (id: string, productId: string) => {
    const productName =
      orderProductOptions.find((item) => item.productId === productId)?.productName ?? "";
    setInvoiceItemsDraft((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, productId, name: item.name.trim() ? item.name : productName }
          : item
      )
    );
  };

  const createManualDraftId = (items: InvoiceItemDraft[]) => {
    let nextIndex = items.length + 1;
    while (items.some((item) => item.id === `manual-${nextIndex}`)) {
      nextIndex += 1;
    }
    return `manual-${nextIndex}`;
  };

  const appendInvoiceItemDraft = (draft: Omit<InvoiceItemDraft, "id">) => {
    setInvoiceItemsDraft((prev) => [
      ...prev,
      {
        id: createManualDraftId(prev),
        ...draft,
      },
    ]);
  };

  const addInvoiceItemDraft = () => {
    const defaultProductId = order.items[0]?.productId ?? "";
    appendInvoiceItemDraft({
      productId: defaultProductId,
      name: "",
      quantity: "1",
      unitPrice: "0.00",
      vatRate: "20",
      width: "",
      height: "",
      selectedOptions: undefined,
    });
  };

  const handleAddCatalogDraftItem = (item: CatalogDraftItem) => {
    appendInvoiceItemDraft({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      width: item.width,
      height: item.height,
      selectedOptions: item.selectedOptions,
    });
  };

  const removeInvoiceItemDraft = (id: string) => {
    setInvoiceItemsDraft((prev) => prev.filter((item) => item.id !== id));
  };

  const resetInvoiceItemsDraft = () => {
    setInvoiceItemsDraft(
      order.items.map((item, index) => {
        const safeQuantity = item.quantity > 0 ? item.quantity : 1;
        const unitPrice = item.priceNet / safeQuantity;
        const vatRate = item.priceNet > 0 ? (item.priceVat / item.priceNet) * 100 : 20;
        return {
          id: item.id || `item-${index}`,
          productId: item.productId,
          name: item.productName,
          quantity: String(safeQuantity),
          unitPrice: formatMoneyInput(unitPrice),
          vatRate: String(Math.round(vatRate * 100) / 100),
          width: item.width === null || item.width === undefined ? "" : String(item.width),
          height: item.height === null || item.height === undefined ? "" : String(item.height),
          selectedOptions: item.selectedOptions,
        };
      })
    );
  };

  const buildInvoiceOverridesPayload = () => {
    const payload: Record<string, unknown> = {};

    const invoicePrefix = invoiceMetaForm.invoicePrefix.trim();
    const invoiceNumber = invoiceMetaForm.invoiceNumber.trim();
    const issueDate = invoiceMetaForm.issueDate.trim();
    const taxDate = invoiceMetaForm.taxDate.trim();
    const dueDate = invoiceMetaForm.dueDate.trim();

    if (invoicePrefix) payload.invoicePrefix = invoicePrefix;
    if (invoiceNumber) payload.invoiceNumber = invoiceNumber;
    if (issueDate) payload.issueDate = issueDate;
    if (taxDate) payload.taxDate = taxDate;
    if (dueDate) payload.dueDate = dueDate;

    return payload;
  };

  const handleSaveInvoiceEdits = async () => {
    const customerName = invoiceForm.customerName.trim();
    const customerEmail = invoiceForm.customerEmail.trim();

    if (!customerName) {
      toast.error("Meno zákazníka je povinné.");
      return;
    }

    if (!customerEmail) {
      toast.error("E-mail zákazníka je povinný.");
      return;
    }

    setIsSavingInvoiceEdits(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone: invoiceForm.customerPhone.trim() || null,
          paymentMethod: invoiceForm.paymentMethod,
          deliveryMethod: invoiceForm.deliveryMethod,
          billingAddress: buildInvoiceAddressPayload(invoiceForm.billingAddress, true),
          shippingAddress: buildInvoiceAddressPayload(invoiceForm.shippingAddress, false),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Nepodarilo sa uložiť údaje faktúry.");
      }

      toast.success("Údaje faktúry boli uložené.");
      setIsEditingShippingDetails(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa uložiť údaje faktúry.";
      toast.error(message);
    } finally {
      setIsSavingInvoiceEdits(false);
    }
  };

  const handleSaveOrderItems = async () => {
    const payloadItems = invoiceItemsDraft
      .map((item, index) => {
        const name = item.name.trim();
        const quantity = Number(item.quantity);
        const unitPriceNet = Number(item.unitPrice);
        const vatRatePercent = Number(item.vatRate);
        const productId = item.productId?.trim();
        const widthValue = item.width.trim();
        const heightValue = item.height.trim();
        const width = widthValue === "" ? null : Number(widthValue);
        const height = heightValue === "" ? null : Number(heightValue);

        if (!name) throw new Error(`Položka #${index + 1}: názov je povinný.`);
        if (!productId) throw new Error(`Položka #${index + 1}: vyberte produkt.`);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Položka #${index + 1}: množstvo musí byť väčšie ako 0.`);
        }
        if (!Number.isFinite(unitPriceNet) || unitPriceNet < 0) {
          throw new Error(`Položka #${index + 1}: cena bez DPH musí byť 0 alebo viac.`);
        }
        if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
          throw new Error(`Položka #${index + 1}: DPH musí byť medzi 0 a 100.`);
        }
        if (width !== null && (!Number.isFinite(width) || width <= 0)) {
          throw new Error(`Položka #${index + 1}: šírka musí byť väčšia ako 0.`);
        }
        if (height !== null && (!Number.isFinite(height) || height <= 0)) {
          throw new Error(`Položka #${index + 1}: výška musí byť väčšia ako 0.`);
        }

        return {
          id: item.id.startsWith("manual-") ? undefined : item.id,
          productId,
          name,
          quantity,
          unitPriceNet,
          vatRatePercent,
          width,
          height,
          selectedOptions: item.selectedOptions ?? null,
        };
      });

    setIsSavingOrderItems(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Nepodarilo sa uložiť položky objednávky.");
      }

      toast.success("Položky objednávky boli uložené.");
      setIsEditingInvoiceItems(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa uložiť položky objednávky.";
      toast.error(message);
    } finally {
      setIsSavingOrderItems(false);
    }
  };

  const handleSendInvoice = async () => {
    setIsSendingInvoice(true);
    try {
      const payload = buildInvoiceOverridesPayload();
      const response = await fetch(`/api/orders/${order.id}/invoice/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify(payload),
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
      const payload = buildInvoiceOverridesPayload();
      const response = await fetch(`/api/orders/${order.id}/invoice/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify(payload),
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

  const handleRegenerateInvoice = async () => {
    setIsRegeneratingInvoice(true);
    try {
      const payload = buildInvoiceOverridesPayload();
      const response = await fetch(`/api/orders/${order.id}/invoice/create?force=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Nepodarilo sa znovu vygenerovať faktúru");
      }

      toast.success(data.message ?? "Faktúra bola znovu vygenerovaná.");
      fetchAssets();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa znovu vygenerovať faktúru";
      toast.error(message);
    } finally {
      setIsRegeneratingInvoice(false);
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

  const handleDeleteOrder = async () => {
    const confirmed = window.confirm(
      "Naozaj chcete natrvalo odstrániť túto objednávku?"
    );
    if (!confirmed) return;

    setIsDeletingOrder(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Nepodarilo sa odstrániť objednávku.");
      }

      toast.success("Objednávka bola odstránená.");
      router.push("/admin/orders");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa odstrániť objednávku.";
      toast.error(message);
    } finally {
      setIsDeletingOrder(false);
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
              <TabsTrigger value="shipping">Fakturácia / doprava</TabsTrigger>
              <TabsTrigger value="files">Súbory</TabsTrigger>
              <TabsTrigger value="history">História</TabsTrigger>
              <TabsTrigger value="events">Udalosti</TabsTrigger>
            </TabsList>

            <TabsContent value="items">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Položky objednávky</CardTitle>
                    {!isEditingInvoiceItems ? (
                      <AdminButton size="sm" variant="outline" onClick={() => setIsEditingInvoiceItems(true)}>
                        Upraviť
                      </AdminButton>
                    ) : (
                      <div className="flex gap-2">
                        <AdminButton
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resetInvoiceItemsDraft();
                            setIsEditingInvoiceItems(false);
                          }}
                        >
                          Zrušiť
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="primary"
                          onClick={handleSaveOrderItems}
                          disabled={isSavingOrderItems}
                        >
                          {isSavingOrderItems ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Ukladám...
                            </>
                          ) : (
                            "Uložiť položky"
                          )}
                        </AdminButton>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditingInvoiceItems ? (
                    <div className="space-y-4">
                      {order.items.map((item, index) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="flex justify-between border-b pb-4 last:border-0 last:pb-0"
                        >
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
                            {(() => {
                              const designElements = getDesignElementCount(item.designData);
                              if (designElements <= 0) return null;
                              return (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-600">
                                  Design Studio ({designElements} elementov)
                                </div>
                              );
                            })()}
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

                      {shippingGrossTotal > 0 ? (
                        <div className="flex justify-between border-b pb-4">
                          <div>
                            <p className="font-medium">Doprava</p>
                            <p className="text-sm text-muted-foreground">
                              {mapDeliveryMethodLabel(order.deliveryMethod)}
                            </p>
                          </div>
                          <p className="font-semibold">{formatPrice(shippingGrossTotal)}</p>
                        </div>
                      ) : null}

                      {customerAssetsWithoutItem.length > 0 ? (
                        <div className="rounded-md border border-dashed p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Súbory od zákazníka bez väzby na položku
                          </p>
                          <div className="space-y-2">
                            {customerAssetsWithoutItem.map((asset) => (
                              <div key={asset.id} className="flex items-center justify-between gap-2">
                                <p className="truncate text-xs" title={asset.fileNameOriginal}>
                                  {asset.fileNameOriginal}
                                </p>
                                <AdminButton asChild size="sm" variant="outline">
                                  <a href={`/api/assets/${asset.id}/download`}>Stiahnuť</a>
                                </AdminButton>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invoiceItemsDraft.map((item) => (
                        <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-12">
                          <div className="md:col-span-3">
                            <Label className="mb-1 block text-xs">Produkt</Label>
                            <Select
                              value={item.productId}
                              onValueChange={(value) => setInvoiceItemProductId(item.id, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Vyberte produkt" />
                              </SelectTrigger>
                              <SelectContent>
                                {orderProductOptions.map((option) => (
                                  <SelectItem key={option.productId} value={option.productId}>
                                    {option.productName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-3">
                            <Label className="mb-1 block text-xs">Názov položky</Label>
                            <Input
                              placeholder="Názov položky"
                              value={item.name}
                              onChange={setInvoiceItemField(item.id, "name")}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="mb-1 block text-xs">Množstvo</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={setInvoiceItemField(item.id, "quantity")}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="mb-1 block text-xs">Cena bez DPH</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={setInvoiceItemField(item.id, "unitPrice")}
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Label className="mb-1 block text-xs">DPH %</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.vatRate}
                              onChange={setInvoiceItemField(item.id, "vatRate")}
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Label className="mb-1 block text-xs">&nbsp;</Label>
                            <AdminButton
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => removeInvoiceItemDraft(item.id)}
                              disabled={invoiceItemsDraft.length <= 1}
                            >
                              X
                            </AdminButton>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-md border border-dashed p-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Pridať novú položku
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton size="sm" variant="outline" onClick={addInvoiceItemDraft}>
                            Pridať ručne
                          </AdminButton>
                          <AdminButton
                            size="sm"
                            variant="outline"
                            onClick={() => setIsCatalogDialogOpen(true)}
                          >
                            Vybrať z katalógu
                          </AdminButton>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-wrap flex-col items-end gap-x-6 gap-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Medzisúčet položiek:</span>
                        <span className="font-medium">{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Doručenie:</span>
                        <span className="font-medium">{formatPrice(shippingGrossTotal)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">DPH:</span>
                        <span className="font-medium">{formatPrice(order.vatAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Objednávka celkom:</span>
                        <span className="text-base font-semibold">{formatPrice(order.total)}</span>
                      </div>
                    </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Fakturácia / doprava</CardTitle>
                    {!isEditingShippingDetails ? (
                      <AdminButton
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingShippingDetails(true)}
                      >
                        Upraviť
                      </AdminButton>
                    ) : (
                      <div className="flex gap-2">
                        <AdminButton
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resetInvoiceFormToOrder();
                            setIsEditingShippingDetails(false);
                          }}
                        >
                          Zrušiť
                        </AdminButton>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditingShippingDetails ? (
                    <>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">Meno: </span>
                          {invoiceForm.customerName || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">E-mail: </span>
                          {invoiceForm.customerEmail || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Telefón: </span>
                          {invoiceForm.customerPhone || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Metóda doručenia: </span>
                          {mapDeliveryMethodLabel(invoiceForm.deliveryMethod)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Platba: </span>
                          {invoiceForm.paymentMethod}
                        </p>
                      </div>

                      <div className="grid gap-4 border-t pt-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fakturačná adresa
                          </p>
                          <AddressPreview value={order.billingAddress} />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Dodacia adresa
                          </p>
                          <AddressPreview value={order.shippingAddress} />
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Pickup point
                        </p>
                        <JsonPreview value={order.pickupPoint} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="ship-customer-name">Meno zákazníka</Label>
                          <Input
                            id="ship-customer-name"
                            value={invoiceForm.customerName}
                            onChange={setInvoiceField("customerName")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ship-customer-email">E-mail</Label>
                          <Input
                            id="ship-customer-email"
                            type="email"
                            value={invoiceForm.customerEmail}
                            onChange={setInvoiceField("customerEmail")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ship-customer-phone">Telefón</Label>
                          <Input
                            id="ship-customer-phone"
                            value={invoiceForm.customerPhone}
                            onChange={setInvoiceField("customerPhone")}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Spôsob platby</Label>
                          <Select
                            value={invoiceForm.paymentMethod}
                            onValueChange={(value) =>
                              setInvoiceForm((prev) => ({
                                ...prev,
                                paymentMethod: value as "STRIPE" | "BANK_TRANSFER" | "COD",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STRIPE">Platba kartou</SelectItem>
                              <SelectItem value="BANK_TRANSFER">Bankový prevod</SelectItem>
                              <SelectItem value="COD">Dobierka</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Spôsob doručenia</Label>
                          <Select
                            value={invoiceForm.deliveryMethod}
                            onValueChange={(value) =>
                              setInvoiceForm((prev) => ({
                                ...prev,
                                deliveryMethod: value as "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DPD_COURIER">DPD kuriér</SelectItem>
                              <SelectItem value="DPD_PICKUP">DPD Pickup/Pickup Station</SelectItem>
                              <SelectItem value="PERSONAL_PICKUP">Osobný odber - Rozvojová 2, Košice</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 border-t pt-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fakturačná adresa
                          </p>
                          <Input
                            placeholder="Meno / Firma"
                            value={invoiceForm.billingAddress.name}
                            onChange={setInvoiceAddressField("billingAddress", "name")}
                          />
                          <Input
                            placeholder="Ulica"
                            value={invoiceForm.billingAddress.street}
                            onChange={setInvoiceAddressField("billingAddress", "street")}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="PSČ"
                              value={invoiceForm.billingAddress.postalCode}
                              onChange={setInvoiceAddressField("billingAddress", "postalCode")}
                            />
                            <Input
                              placeholder="Mesto"
                              value={invoiceForm.billingAddress.city}
                              onChange={setInvoiceAddressField("billingAddress", "city")}
                            />
                          </div>
                          <Input
                            placeholder="Krajina"
                            value={invoiceForm.billingAddress.country}
                            onChange={setInvoiceAddressField("billingAddress", "country")}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="IČO"
                              value={invoiceForm.billingAddress.ico}
                              onChange={setInvoiceAddressField("billingAddress", "ico")}
                            />
                            <Input
                              placeholder="DIČ"
                              value={invoiceForm.billingAddress.dic}
                              onChange={setInvoiceAddressField("billingAddress", "dic")}
                            />
                            <Input
                              placeholder="IČ DPH"
                              value={invoiceForm.billingAddress.icDph}
                              onChange={setInvoiceAddressField("billingAddress", "icDph")}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Dodacia adresa
                          </p>
                          <Input
                            placeholder="Meno / Firma"
                            value={invoiceForm.shippingAddress.name}
                            onChange={setInvoiceAddressField("shippingAddress", "name")}
                          />
                          <Input
                            placeholder="Ulica"
                            value={invoiceForm.shippingAddress.street}
                            onChange={setInvoiceAddressField("shippingAddress", "street")}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="PSČ"
                              value={invoiceForm.shippingAddress.postalCode}
                              onChange={setInvoiceAddressField("shippingAddress", "postalCode")}
                            />
                            <Input
                              placeholder="Mesto"
                              value={invoiceForm.shippingAddress.city}
                              onChange={setInvoiceAddressField("shippingAddress", "city")}
                            />
                          </div>
                          <Input
                            placeholder="Krajina"
                            value={invoiceForm.shippingAddress.country}
                            onChange={setInvoiceAddressField("shippingAddress", "country")}
                          />
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Pickup point
                        </p>
                        <JsonPreview value={order.pickupPoint} />
                      </div>

                      <AdminButton
                        variant="outline"
                        className="w-full"
                        onClick={handleSaveInvoiceEdits}
                        disabled={isSavingInvoiceEdits}
                      >
                        {isSavingInvoiceEdits ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Ukladám...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Uložiť fakturáciu a dopravu
                          </>
                        )}
                      </AdminButton>
                    </>
                  )}
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
                  variant="outline"
                  className="w-full"
                  onClick={handleRegenerateInvoice}
                  disabled={isRegeneratingInvoice || !hasInvoiceAsset}
                >
                  {isRegeneratingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Regenerujem...
                    </>
                  ) : (
                    <>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Regenerovať faktúru
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
                Faktúra bude odoslaná na: {invoiceForm.customerEmail.trim() || order.customerEmail}
              </p>
              {hasInvoiceAsset && (
                <p className="text-xs text-muted-foreground">
                  Faktúra už bola vygenerovaná. Ak upravíte údaje, použite Regenerovať faktúru.
                </p>
              )}
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nastavenie faktúry
                  </p>
                  {!isEditingInvoiceMeta ? (
                    <AdminButton size="sm" variant="outline" onClick={() => setIsEditingInvoiceMeta(true)}>
                      Upraviť
                    </AdminButton>
                  ) : (
                    <div className="flex gap-2">
                      <AdminButton
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          resetInvoiceMetaForm();
                          setIsEditingInvoiceMeta(false);
                        }}
                      >
                        Zrušiť
                      </AdminButton>
                      <AdminButton size="sm" variant="primary" onClick={() => setIsEditingInvoiceMeta(false)}>
                        Hotovo
                      </AdminButton>
                    </div>
                  )}
                </div>
                {!isEditingInvoiceMeta ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Prefix: </span>
                      {invoiceMetaForm.invoicePrefix.trim() || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Číslo faktúry: </span>
                      {invoiceMetaForm.invoiceNumber.trim()
                        ? invoiceMetaForm.invoiceNumber.trim()
                        : `Automaticky (${autoInvoiceNumberPreview})`}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dátum vystavenia: </span>
                      {invoiceMetaForm.issueDate || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dátum zdan. plnenia: </span>
                      {invoiceMetaForm.taxDate || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dátum splatnosti: </span>
                      {invoiceMetaForm.dueDate || "—"}
                    </p>
                    {isLoadingInvoiceMetaDefaults ? (
                      <p className="text-xs text-muted-foreground">Načítavam aktuálne PDF nastavenia...</p>
                    ) : null}
                    {invoiceMetaDefaultsError ? (
                      <p className="text-xs text-destructive">{invoiceMetaDefaultsError}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-prefix">Prefix</Label>
                      <Input
                        id="invoice-prefix"
                        placeholder="Napr. FA"
                        value={invoiceMetaForm.invoicePrefix}
                        onChange={(event) =>
                          setInvoiceMetaForm((prev) => ({ ...prev, invoicePrefix: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-number">Číslo faktúry</Label>
                      <Input
                        id="invoice-number"
                        placeholder={`Nechať prázdne pre auto číslovanie (${autoInvoiceNumberPreview})`}
                        value={invoiceMetaForm.invoiceNumber}
                        onChange={(event) =>
                          setInvoiceMetaForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="invoice-issue-date">Dátum vystavenia</Label>
                        <Input
                          id="invoice-issue-date"
                          type="date"
                          value={invoiceMetaForm.issueDate}
                          onChange={(event) =>
                            setInvoiceMetaForm((prev) => ({ ...prev, issueDate: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-tax-date">Dátum zdan. plnenia</Label>
                        <Input
                          id="invoice-tax-date"
                          type="date"
                          value={invoiceMetaForm.taxDate}
                          onChange={(event) =>
                            setInvoiceMetaForm((prev) => ({ ...prev, taxDate: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-due-date">Dátum splatnosti</Label>
                        <Input
                          id="invoice-due-date"
                          type="date"
                          value={invoiceMetaForm.dueDate}
                          onChange={(event) =>
                            setInvoiceMetaForm((prev) => ({ ...prev, dueDate: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
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
              <CardTitle>Nebezpečná zóna</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Odstránenie objednávky je trvalé a nie je možné ho vrátiť späť.
              </p>
              <AdminButton
                variant="danger"
                className="w-full"
                onClick={handleDeleteOrder}
                disabled={isDeletingOrder}
              >
                {isDeletingOrder ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Odstraňujem...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Odstrániť objednávku
                  </>
                )}
              </AdminButton>
            </CardContent>
          </Card>

        </div>
      </div>

      <OrderItemCatalogDialog
        open={isCatalogDialogOpen}
        onOpenChange={setIsCatalogDialogOpen}
        audience={order.audience}
        onAddItem={handleAddCatalogDraftItem}
      />
    </div>
  );
}
