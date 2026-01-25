import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AdminOrdersList } from "@/components/admin/admin-orders-list";
import { Skeleton } from "@/components/ui/skeleton";

async function getOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return orders.map(order => ({
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    items: order.items.map(item => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  }));
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Objednávky</h1>
        <p className="text-muted-foreground">
          Spravujte všetky objednávky
        </p>
      </div>

      <Suspense fallback={<Skeleton className="w-full h-96" />}>
        <AdminOrdersList orders={orders} />
      </Suspense>
    </div>
  );
}
