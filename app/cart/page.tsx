import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CartContent } from "@/components/cart/cart-content";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAudienceContext } from "@/lib/audience-context";
import { EmptyCart } from "@/components/print/empty-cart";
import { getShopVatRate } from "@/lib/shop-settings";

export const metadata = {
  title: "Košík",
  description: "Nákupný košík",
};

async function CartItems() {
  const audienceContext = await resolveAudienceContext({});
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c";
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session_id")?.value;
  const cart = await getCart(sessionId);
  const vatRate = await getShopVatRate();

  if (!cart || cart.items.length === 0) {
    return <EmptyCart mode={mode} />;
  }

  // Serialize Decimal values for client component
  const serializedCart = {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
    })),
  };

  return <CartContent cart={serializedCart} mode={mode} vatRate={vatRate} />;
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <CartItems />
    </Suspense>
  );
}
