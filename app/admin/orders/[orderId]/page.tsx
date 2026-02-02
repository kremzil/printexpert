import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminOrderDetail } from "@/components/admin/admin-order-detail";

interface AdminOrderPageProps {
  params: Promise<{ orderId: string }>;
}

async function getOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          changedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      stripeEvents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
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
    statusHistory: order.statusHistory.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
    stripeEvents: order.stripeEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="p-6">
      <AdminOrderDetail order={order} />
    </div>
  );
}
