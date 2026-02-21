import { Suspense } from "react";
import { getUserOrders } from "@/lib/orders";
import { OrdersList } from "@/components/cart/orders-list";
import { Skeleton } from "@/components/ui/skeleton";
import { buildStaticPageMetadata } from "@/lib/seo";

export const metadata = buildStaticPageMetadata("accountOrders");

async function OrdersContent() {
  const orders = await getUserOrders();

  return <OrdersList orders={orders} />;
}

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Moje objednávky</h2>
        <p className="text-sm text-muted-foreground">
          História vašich objednávok a ich stav.
        </p>
      </div>
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
