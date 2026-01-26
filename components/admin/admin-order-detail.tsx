"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";

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
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface AdminOrderDetailProps {
  order: Order;
}

const statusMap: Record<OrderStatus, { label: string; variant: "secondary" | "default" | "destructive" }> = {
  PENDING: { label: "Čaká sa", variant: "secondary" },
  CONFIRMED: { label: "Potvrdená", variant: "default" },
  PROCESSING: { label: "Spracováva sa", variant: "default" },
  COMPLETED: { label: "Dokončená", variant: "default" },
  CANCELLED: { label: "Zrušená", variant: "destructive" },
};

export function AdminOrderDetail({ order }: AdminOrderDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Objednávka #{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <Badge variant={statusMap[status].variant} className="text-base px-4 py-1">
          {statusMap[status].label}
        </Badge>
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
                      {item.selectedOptions && 
                       typeof item.selectedOptions === 'object' && 
                       '_attributes' in item.selectedOptions && 
                       item.selectedOptions._attributes &&
                       typeof item.selectedOptions._attributes === 'object' &&
                       Object.keys(item.selectedOptions._attributes).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {Object.entries(item.selectedOptions._attributes as Record<string, string>).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {value}
                            </div>
                          ))}
                        </div>
                      )}
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
        </div>

        <div className="lg:col-span-1 space-y-6">
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
