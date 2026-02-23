import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProductCalculatorData } from "@/lib/pricing";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async (
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      priceType: true,
      priceFrom: true,
      priceAfterDiscountFrom: true,
      vatRate: true,
      isActive: true,
    },
  });

  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Produkt neexistuje." }, { status: 404 });
  }

  const calculatorData = await getProductCalculatorData({ productId: product.id });

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceType: product.priceType,
      priceFrom: product.priceFrom ? Number(product.priceFrom) : null,
      priceAfterDiscountFrom: product.priceAfterDiscountFrom
        ? Number(product.priceAfterDiscountFrom)
        : null,
      vatRate: Number(product.vatRate),
    },
    calculatorData,
  });
};

export const GET = withObservedRoute(
  "GET /api/admin/products/[productId]/configurator",
  GETHandler
);

