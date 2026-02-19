import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TAGS } from '@/lib/cache-tags';
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const audience = searchParams.get('audience') || 'b2c';

  const config = await prisma.topProducts.findUnique({
    where: { audience },
  });

  if (!config) {
    return NextResponse.json({
      mode: 'MANUAL',
      categoryIds: [],
      productIds: [],
    });
  }

  return NextResponse.json({
    mode: config.mode,
    categoryIds: config.categoryIds,
    productIds: config.productIds,
  });
}

const POSTHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { audience, productIds } = body;

  if (!audience || !['b2b', 'b2c'].includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
  }

  const config = await prisma.topProducts.upsert({
    where: { audience },
    update: {
      mode: 'MANUAL',
      categoryIds: [],
      productIds: productIds || [],
    },
    create: {
      audience,
      mode: 'MANUAL',
      categoryIds: [],
      productIds: productIds || [],
    },
  });

  revalidateTag(TAGS.TOP_PRODUCTS, 'max');
  return NextResponse.json(config);
}

export const GET = withObservedRoute("GET /api/admin/top-products", GETHandler);
export const POST = withObservedRoute("POST /api/admin/top-products", POSTHandler);



