import { NextRequest, NextResponse } from 'next/server';
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

  if (!config || config.mode === 'RANDOM_ALL') {
    // Случайный выбор из всех доступных продуктов для данного типа
    const allProducts = await prisma.product.findMany({
      where: {
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

    products = shuffleArray(allProducts).slice(0, count);
  } else if (config.mode === 'RANDOM_CATEGORIES') {
    // Случайный выбор из выбранных категорий
    const categoryProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        ...productAudienceFilter,
        categoryId: {
          in: config.categoryIds,
        },
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

    products = shuffleArray(categoryProducts).slice(0, count);
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

    // Дополнить случайными, если не хватает
    if (products.length < count) {
      const additionalProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          ...productAudienceFilter,
          id: {
            notIn: config.productIds,
          },
          category: {
            isActive: true,
            ...categoryAudienceFilter,
          },
        },
        take: count - products.length,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      products = [...products, ...shuffleArray(additionalProducts)];
    }
  }

  // Заполнить до нужного количества, если продуктов меньше
  if (!products || products.length < count) {
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

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
