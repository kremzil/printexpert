"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModeButton } from "@/components/print/mode-button";
import { StatusBadge } from "@/components/print/status-badge";
import { ExternalLink } from "lucide-react";

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

const statusMap = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

const paymentStatusMap: Record<
  PaymentStatus,
  { label: string; variant: "secondary" | "default" | "destructive" }
> = {
  UNPAID: { label: "Nezaplatená", variant: "secondary" },
  PENDING: { label: "Čaká na platbu", variant: "secondary" },
  PAID: { label: "Zaplatená", variant: "default" },
  FAILED: { label: "Neúspešná", variant: "destructive" },
  REFUNDED: { label: "Refundovaná", variant: "destructive" },
};

export function AdminOrdersList({ orders }: AdminOrdersListProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-muted-foreground">
            Zatiaľ nie sú žiadne objednávky
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const status = statusMap[order.status];
        const paymentStatus = paymentStatusMap[order.paymentStatus];
        return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Objednávka #{order.orderNumber}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
                  <StatusBadge status={status} size="sm" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Zákazník</p>
                  <p className="text-sm font-medium">{order.customerName}</p>
                  <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                  {order.user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Účet: {order.user.email}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Položky</p>
                  <p className="text-sm font-medium">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} ks
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} {order.items.length === 1 ? "produkt" : "produkty"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Suma</p>
                  <p className="text-lg font-bold">{formatPrice(order.total)}</p>
                </div>
                <div className="flex items-center justify-end">
                  <ModeButton asChild variant="outline" size="sm">
                    <Link href={`/admin/orders/${order.id}`}>
                      Detail
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </ModeButton>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
