"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeButton } from "@/components/print/mode-button";
import { StatusBadge } from "@/components/print/status-badge";
import type { OrderData } from "@/types/order";

interface OrdersListProps {
  orders: OrderData[];
}

const statusMap = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export function OrdersList({ orders }: OrdersListProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground mb-4">Zatiaľ nemáte žiadne objednávky</p>
          <ModeButton asChild>
            <Link href="/catalog">Začať nakupovať</Link>
          </ModeButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const status = statusMap[order.status];
        return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Objednávka #{order.orderNumber}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <StatusBadge status={status} size="sm" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Položky: </span>
                  <span>{order.items.length}</span>
                </div>
                
                <div className="text-sm">
                  <span className="text-muted-foreground">Celková suma: </span>
                  <span className="font-semibold">{formatPrice(Number(order.total))}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <ModeButton asChild variant="outline" size="sm">
                    <Link href={`/account/orders/${order.id}`}>
                      Zobraziť detail
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
