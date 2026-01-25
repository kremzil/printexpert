import { Suspense } from "react";
import { getUserOrders } from "@/lib/orders";
import { OrdersList } from "@/components/cart/orders-list";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Moje objednávky",
  description: "História objednávok",
};

async function OrdersContent() {
  const orders = await getUserOrders();

  return <OrdersList orders={orders} />;
}

export default function OrdersPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Moje objednávky</h1>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <OrdersContent />
      </Suspense>
    </div>
  );
}
