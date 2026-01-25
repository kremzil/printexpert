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
  };
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div>
      <AdminOrderDetail order={order} />
    </div>
  );
}
