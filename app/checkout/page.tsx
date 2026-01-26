import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Pokladňa",
  description: "Dokončenie objednávky",
};

async function CheckoutContent() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session_id")?.value;
  const cart = await getCart(sessionId);

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
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

  return <CheckoutForm cart={serializedCart} />;
}

export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Pokladňa</h1>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
