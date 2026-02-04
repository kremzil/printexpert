import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CartContent } from "@/components/cart/cart-content";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAudienceContext } from "@/lib/audience-context";
import { EmptyCart } from "@/components/print/empty-cart";
import { getShopVatRate } from "@/lib/shop-settings";
import { getWpCalculatorData } from "@/lib/wp-calculator";

const parseNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBreakpoints = (value: string | null | undefined) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
};

const getNumbersEntry = (
  numbersArray: Array<string | null> | Record<string, string | null>,
  mtid: string
) => {
  if (Array.isArray(numbersArray)) {
    return numbersArray[Number(mtid)] ?? null;
  }
  return numbersArray[mtid] ?? null;
};

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

  const calculatorCache = new Map<number, Awaited<ReturnType<typeof getWpCalculatorData>>>();
  const getCalculator = async (wpProductId: number) => {
    if (calculatorCache.has(wpProductId)) {
      return calculatorCache.get(wpProductId) ?? null;
    }
    const data = await getWpCalculatorData(wpProductId, true);
    calculatorCache.set(wpProductId, data);
    return data;
  };

  // Serialize Decimal values for client component
  const serializedCart = {
    ...cart,
    items: await Promise.all(
      cart.items.map(async (item) => {
        let quantityPresets: number[] | undefined;
        const wpProductId = item.product.wpProductId;

        if (typeof wpProductId === "number") {
          const calculatorData = await getCalculator(wpProductId);
          if (calculatorData && calculatorData.matrices.length > 0) {
            const baseMatrix =
              calculatorData.matrices.find((matrix) => matrix.kind === "simple") ??
              calculatorData.matrices[0];
            const baseNumStyle = parseNumber(baseMatrix?.numStyle) ?? 0;
            const baseNumType = parseNumber(baseMatrix?.ntp) ?? 0;
            const baseBreakpoints = parseBreakpoints(
              getNumbersEntry(calculatorData.globals.numbers_array, baseMatrix.mtid)
            ).sort((a, b) => a - b);
            const useQuantitySelect =
              baseNumStyle === 1 && baseNumType === 0 && baseBreakpoints.length > 0;

            if (useQuantitySelect) {
              quantityPresets = baseBreakpoints;
            }
          }
        }

        return {
          ...item,
          width: item.width ? Number(item.width) : null,
          height: item.height ? Number(item.height) : null,
          quantityPresets,
        };
      })
    ),
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
