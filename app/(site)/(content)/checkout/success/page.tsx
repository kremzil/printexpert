import { OrderSuccess } from "@/components/print/order-success";
import { resolveAudienceContext } from "@/lib/audience-context";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

type SearchParams = {
  orderId?: string;
  orderNumber?: string;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const orderId = resolvedSearchParams?.orderId;
  const orderNumberParam = resolvedSearchParams?.orderNumber;
  let orderNumber =
    typeof orderNumberParam === "string" && orderNumberParam.trim().length > 0
      ? orderNumberParam
      : undefined;

  if (!orderNumber && typeof orderId === "string" && orderId.trim().length > 0) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    orderNumber = order?.orderNumber;
  }

  const audienceContext = await resolveAudienceContext({});
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12">
        <OrderSuccess mode={mode} orderNumber={orderNumber} />
      </div>
    </div>
  );
}
