import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAudienceContext } from "@/lib/audience-context";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Pokladňa",
  description: "Dokončenie objednávky",
};

async function CheckoutContent({ mode }: { mode: "b2b" | "b2c" }) {
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

  return <CheckoutForm cart={serializedCart} mode={mode} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <div className="container-main py-8">
          <div className="space-y-4">
            <Skeleton className="h-14 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          </div>
        </div>
      }
    >
      <CheckoutShell />
    </Suspense>
  );
}

async function CheckoutShell() {
  const audienceContext = await resolveAudienceContext({});
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c";

  return (
    <div className="min-h-screen bg-background">
      <div className="container-main py-8">
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/cart"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Späť do košíka
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold">Pokladňa</h2>
              <p className="text-sm text-muted-foreground">
                Bezpečný checkout s potvrdením objednávky.
              </p>
            </div>
          </div>
        </div>
        <CheckoutContent mode={mode} />
      </div>
    </div>
  );
}
