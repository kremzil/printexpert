import { NextRequest, NextResponse } from 'next/server';
import { getTopProducts } from '@/lib/catalog';
import { withObservedRoute } from "@/lib/observability/with-observed-route";

export const dynamic = 'force-dynamic';

const GETHandler = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const audience = searchParams.get('audience') || 'b2c';
    const rawCount = parseInt(searchParams.get('count') || '8', 10);
    const count = Number.isFinite(rawCount)
      ? Math.min(Math.max(rawCount, 1), 24)
      : 8;
    const products = await getTopProducts(audience, count);
    return NextResponse.json(products || []);
  } catch (error) {
    console.error('Error fetching top products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export const GET = withObservedRoute("GET /api/top-products", GETHandler);



