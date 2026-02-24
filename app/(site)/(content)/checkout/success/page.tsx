import { OrderSuccess } from "@/components/print/order-success";
import { resolveAudienceContext } from "@/lib/audience-context";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

type SearchParams = {
  orderId?: string;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const orderId = resolvedSearchParams?.orderId;
  const audienceContext = await resolveAudienceContext({});
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12">
        <OrderSuccess mode={mode} orderNumber={orderId} />
      </div>
    </div>
  );
}
