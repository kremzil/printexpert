import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
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
      mode: 'RANDOM_ALL',
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

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { audience, mode, categoryIds, productIds } = body;

  if (!audience || !['b2b', 'b2c'].includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
  }

  const config = await prisma.topProducts.upsert({
    where: { audience },
    update: {
      mode,
      categoryIds: categoryIds || [],
      productIds: productIds || [],
    },
    create: {
      audience,
      mode,
      categoryIds: categoryIds || [],
      productIds: productIds || [],
    },
  });

  return NextResponse.json(config);
}
