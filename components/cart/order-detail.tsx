"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { ModeButton } from "@/components/print/mode-button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/print/status-badge";
import type { OrderData } from "@/types/order";
import { getCsrfHeader } from "@/lib/csrf";

interface OrderDetailProps {
  order: OrderData;
}

interface OrderAsset {
  id: string;
  orderItemId: string | null;
  kind: "ARTWORK" | "PREVIEW" | "INVOICE" | "OTHER";
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  fileNameOriginal: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

type Address = {
  name?: string;
  companyName?: string;
  ico?: string;
  dic?: string;
  icDph?: string;
  street?: string;
  apt?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

const allowedFormatsLabel = "PDF, AI, EPS, TIFF, PNG, JPG";
const uploadMaxBytes = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES ?? "") || 100_000_000;

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

const statusMap = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

const assetStatusMap = {
  PENDING: { label: "Čaká sa", variant: "secondary" as const },
  UPLOADED: { label: "Nahrané", variant: "default" as const },
  APPROVED: { label: "Schválené", variant: "default" as const },
  REJECTED: { label: "Odmietnuté", variant: "destructive" as const },
};

const assetKindLabels = {
  ARTWORK: "Grafika",
  PREVIEW: "Náhľad",
  INVOICE: "Faktúra",
  OTHER: "Iné",
};

const parseAddress = (value: unknown): Address | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Address;
};

const formatStreetLine = (address: Address) => {
  if (!address.street) return "";
  return address.apt ? `${address.street}, ${address.apt}` : address.street;
};

const formatCityLine = (address: Address) => {
  const parts = [address.postalCode, address.city].filter(Boolean);
  return parts.join(" ");
};

export function OrderDetail({ order }: OrderDetailProps) {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const isUploadFailed = searchParams.get("upload") === "failed";
  const status = statusMap[order.status];
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string>(
    order.items[0]?.id ?? ""
  );
  const clearCartOnSuccessRef = useRef(false);
  const billingAddress = parseAddress(order.billingAddress);
  const shippingAddress = parseAddress(order.shippingAddress);

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

  const resolveItemPrices = (item: OrderData["items"][number]) => {
    const isPerUnit = item.productPriceType === "FIXED";
    const safeQuantity = item.quantity > 0 ? item.quantity : 1;
    const lineTotal = isPerUnit ? item.priceGross * safeQuantity : item.priceGross;
    const unitPrice = lineTotal / safeQuantity;

    return { lineTotal, unitPrice };
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

  useEffect(() => {
    if (!isSuccess || clearCartOnSuccessRef.current) {
      return;
    }

    clearCartOnSuccessRef.current = true;

    fetch("/api/cart/clear", {
      method: "POST",
      headers: { ...getCsrfHeader() },
    })
      .catch((error) => {
        console.error("Failed to clear cart on order success page:", error);
      })
      .finally(() => {
        window.dispatchEvent(new Event("cart-updated"));
      });
  }, [isSuccess]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          orderId: order.id,
          orderItemId: selectedOrderItemId || null,
          kind: "ARTWORK",
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const payload = await presignResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Nepodarilo sa pripraviť upload.");
      }

      const presignData = await presignResponse.json();
      const uploadResponse = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Nahrávanie zlyhalo.");
      }

      const confirmResponse = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ assetId: presignData.assetId }),
      });

      if (!confirmResponse.ok) {
        const payload = await confirmResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Potvrdenie nahratia zlyhalo.");
      }

      setUploadSuccess("Súbor bol úspešne nahraný.");
      await fetchAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nahrávanie zlyhalo.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Objednávka #{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={status} size="lg" />
      </div>

      {isSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Vaša objednávka bola úspešne vytvorená. Na váš email sme odoslali potvrdenie.
          </AlertDescription>
        </Alert>
      )}

      {isUploadFailed && (
        <Alert variant="destructive">
          <AlertDescription>
            Nahrávanie grafiky zlyhalo. Skúste prosím nahrať súbor ešte raz.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Položky objednávky</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between border-b pb-4 last:border-0 last:pb-0">
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
                      {(() => {
                        const { lineTotal, unitPrice } = resolveItemPrices(item);
                        return (
                          <>
                            <p className="font-semibold">{formatPrice(lineTotal)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(unitPrice)} / ks
                            </p>
                          </>
                        );
                      })()}
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
              {order.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Poznámka: </span>
                  <p className="mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(billingAddress || shippingAddress) && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fakturačné údaje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {billingAddress ? (
                    <>
                      {billingAddress.companyName && (
                        <div className="font-medium">{billingAddress.companyName}</div>
                      )}
                      {billingAddress.name && (
                        <div className={billingAddress.companyName ? "text-muted-foreground" : "font-medium"}>
                          {billingAddress.name}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        {formatStreetLine(billingAddress)}
                        <br />
                        {formatCityLine(billingAddress)}
                        <br />
                        {billingAddress.country}
                      </div>
                      {(billingAddress.ico || billingAddress.dic || billingAddress.icDph) && (
                        <div className="pt-2 text-xs text-muted-foreground">
                          {billingAddress.ico && <div>IČO: {billingAddress.ico}</div>}
                          {billingAddress.dic && <div>DIČ: {billingAddress.dic}</div>}
                          {billingAddress.icDph && <div>IČ DPH: {billingAddress.icDph}</div>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">Bez fakturačných údajov</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Adresa doručenia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {shippingAddress ? (
                    <>
                      {shippingAddress.name && (
                        <div className="font-medium">{shippingAddress.name}</div>
                      )}
                      <div className="text-muted-foreground">
                        {formatStreetLine(shippingAddress)}
                        <br />
                        {formatCityLine(shippingAddress)}
                        <br />
                        {shippingAddress.country}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Bez adresy doručenia</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Nahrať grafiku</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Povolené formáty: {allowedFormatsLabel}</p>
                <p>Maximálna veľkosť: {formatBytes(uploadMaxBytes)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priradiť k položke objednávky</label>
                <select
                  value={selectedOrderItemId}
                  onChange={(event) => setSelectedOrderItemId(event.target.value)}
                  disabled={isUploading || order.items.length === 0}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {order.items.length === 0 ? (
                    <option value="">Bez položiek</option>
                  ) : null}
                  {order.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productName} ({item.quantity} ks)
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="file"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {isUploading && (
                <p className="text-xs text-muted-foreground">Nahrávam súbor...</p>
              )}
              {uploadError && (
                <Alert variant="destructive">
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
              {uploadSuccess && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {uploadSuccess}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Nahrané súbory</p>
                {isLoadingAssets && (
                  <p className="text-xs text-muted-foreground">Načítavam zoznam...</p>
                )}
                {!isLoadingAssets && assets.length === 0 && (
                  <p className="text-xs text-muted-foreground">Zatiaľ nemáte nahrané žiadne súbory.</p>
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
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              if (!asset.orderItemId) {
                                return "Bez väzby na položku";
                              }
                              const linkedItem = order.items.find((item) => item.id === asset.orderItemId);
                              if (!linkedItem) {
                                return "Položka nebola nájdená";
                              }
                              return `Položka: ${linkedItem.productName} (${linkedItem.quantity} ks)`;
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assetStatusMap[asset.status].variant}>
                            {assetStatusMap[asset.status].label}
                          </Badge>
                          <ModeButton asChild size="sm" variant="outline">
                            <a href={`/api/assets/${asset.id}/download`}>
                              Stiahnuť
                            </a>
                          </ModeButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Súhrn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medzisoučet</span>
                  <span>{formatPrice(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DPH</span>
                  <span>{formatPrice(Number(order.vatAmount))}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-base">
                  <span>Celkom</span>
                  <span>{formatPrice(Number(order.total))}</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Režim: <span className="uppercase">{order.audience}</span>
                </p>
              </div>

              <div className="pt-4 border-t text-xs text-muted-foreground">
                Faktúru vytvára a odosiela administrátor po dokončení objednávky.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-4">
        <ModeButton asChild variant="outline">
          <Link href="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na objednávky
          </Link>
        </ModeButton>
      </div>
    </div>
  );
}
