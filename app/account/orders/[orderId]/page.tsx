import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { OrderDetail } from "@/components/cart/order-detail";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
}

async function OrderContent({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  if (!order) {
    notFound();
  }

  return <OrderDetail order={order} />;
}

export default async function OrderPage({ params }: OrderPageProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <OrderContent params={params} />
      </Suspense>
    </div>
  );
}
