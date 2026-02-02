"use client";

import { Card, CardContent } from "@/components/ui/card";
import { OrderCard } from "@/components/admin/order-card";

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

export function AdminOrdersList({ orders }: AdminOrdersListProps) {
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          orderId={order.orderNumber}
          date={formatDate(order.createdAt)}
          customer={{
            name: order.customerName,
            email: order.customerEmail,
          }}
          items={order.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
          }))}
          total={order.total}
          status={statusMap[order.status]}
          detailHref={`/admin/orders/${order.id}`}
        />
      ))}
    </div>
  );
}
