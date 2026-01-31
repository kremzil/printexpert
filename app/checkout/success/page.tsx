import { OrderSuccess } from "@/components/print/order-success";
import { resolveAudienceContext } from "@/lib/audience-context";

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
      <div className="container mx-auto px-4 py-12">
        <OrderSuccess mode={mode} orderNumber={orderId} />
      </div>
    </div>
  );
}
