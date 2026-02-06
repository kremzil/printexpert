import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const audience = searchParams.get('audience') || 'b2c';
    const rawCount = parseInt(searchParams.get('count') || '8', 10);
    const count = Number.isFinite(rawCount)
      ? Math.min(Math.max(rawCount, 1), 24)
      : 8;
    const productAudienceFilter =
      audience === 'b2b' ? { showInB2b: true } : { showInB2c: true };
    const categoryAudienceFilter = productAudienceFilter;

    let config;
    try {
      config = await prisma.topProducts.findUnique({
        where: { audience },
      });
    } catch {
      // Таблица может еще не существовать - используем режим по умолчанию
      console.warn('TopProducts table not found, using default mode');
      config = null;
    }

    let products;
    const isManualMode = config?.mode === 'MANUAL';

    if (!config || config.mode === 'RANDOM_ALL') {
      // Случайный выбор из всех доступных продуктов для данного типа
      products = await getRandomProducts({
        audience,
        count,
      });
    } else if (config.mode === 'RANDOM_CATEGORIES') {
      // Случайный выбор из выбранных категорий
      products =
        config.categoryIds && config.categoryIds.length > 0
          ? await getRandomProducts({
              audience,
              count,
              categoryIds: config.categoryIds,
            })
          : [];
    } else if (config.mode === 'MANUAL') {
      // Ручной выбор продуктов
      const manualProducts = await prisma.product.findMany({
        where: {
          id: {
            in: config.productIds,
          },
          isActive: true,
          ...productAudienceFilter,
          category: {
            isActive: true,
            ...categoryAudienceFilter,
          },
        },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      products = manualProducts;
    }

    // Заполнить до нужного количества, если продуктов меньше
    if (!isManualMode && (!products || products.length < count)) {
      const existing = products || [];
      const existingIds = existing.map((p) => p.id);
      const additional = await prisma.product.findMany({
        where: {
          isActive: true,
          ...productAudienceFilter,
          id: {
            notIn: existingIds,
          },
          category: {
            isActive: true,
            ...categoryAudienceFilter,
          },
        },
        take: count - existing.length,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      products = [...existing, ...shuffleArray(additional)];
    }

    return NextResponse.json(products || []);
  } catch (error) {
    console.error('Error fetching top products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

async function getRandomProducts(options: {
  audience: string;
  count: number;
  categoryIds?: string[];
}) {
  const { audience, count, categoryIds } = options;

  if (categoryIds && categoryIds.length === 0) {
    return [];
  }

  const productAudienceSql =
    audience === 'b2b'
      ? Prisma.sql`p."showInB2b" = true`
      : Prisma.sql`p."showInB2c" = true`;
  const categoryAudienceSql =
    audience === 'b2b'
      ? Prisma.sql`c."showInB2b" = true`
      : Prisma.sql`c."showInB2c" = true`;
  const categoryFilterSql =
    categoryIds && categoryIds.length > 0
      ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(categoryIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Product" p
    INNER JOIN "Category" c ON c.id = p."categoryId"
    WHERE p."isActive" = true
      AND c."isActive" = true
      AND ${productAudienceSql}
      AND ${categoryAudienceSql}
      ${categoryFilterSql}
    ORDER BY RANDOM()
    LIMIT ${count};
  `;

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  return products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
