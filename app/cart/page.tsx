import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CartContent } from "@/components/cart/cart-content";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Košík",
  description: "Nákupný košík",
};

async function CartItems() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session_id")?.value;
  const cart = await getCart(sessionId);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-2xl font-semibold mb-2">Váš košík je prázdny</h2>
        <p className="text-muted-foreground mb-6">
          Pridajte produkty do košíka, aby ste mohli pokračovať k objednávke.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Pokračovať v nákupe
        </Link>
      </div>
    );
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

  return <CartContent cart={serializedCart} />;
}

export default function CartPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Nákupný košík</h1>
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
    </div>
  );
}
