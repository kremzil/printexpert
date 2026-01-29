"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderData } from "@/types/order";

interface OrderDetailProps {
  order: OrderData;
}

interface OrderAsset {
  id: string;
  kind: "ARTWORK" | "PREVIEW" | "INVOICE" | "OTHER";
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  fileNameOriginal: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

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
  PENDING: { label: "Čaká sa", variant: "secondary" as const },
  CONFIRMED: { label: "Potvrdená", variant: "default" as const },
  PROCESSING: { label: "Spracováva sa", variant: "default" as const },
  COMPLETED: { label: "Dokončená", variant: "default" as const },
  CANCELLED: { label: "Zrušená", variant: "destructive" as const },
};

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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
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
        headers: { "Content-Type": "application/json" },
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
        <Badge variant={status.variant} className="text-base px-4 py-1">
          {status.label}
        </Badge>
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
                {order.items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex justify-between border-b pb-4 last:border-0 last:pb-0">
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
                        {formatPrice(Number(item.priceGross) * item.quantity)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(Number(item.priceGross))} / ks
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
              <CardTitle>Nahrať grafiku</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Povolené formáty: {allowedFormatsLabel}</p>
                <p>Maximálna veľkosť: {formatBytes(uploadMaxBytes)}</p>
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
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assetStatusMap[asset.status].variant}>
                            {assetStatusMap[asset.status].label}
                          </Badge>
                          <Button asChild size="sm" variant="outline">
                            <a href={`/api/assets/${asset.id}/download`}>
                              Stiahnuť
                            </a>
                          </Button>
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
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na objednávky
          </Link>
        </Button>
      </div>
    </div>
  );
}
