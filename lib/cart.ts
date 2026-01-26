"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@/lib/generated/prisma";
import type { CartItemData, CartItemWithProduct, PriceSnapshot } from "@/types/cart";

/**
 * Получить или создать корзину для текущего пользователя/сессии
 */
export async function getOrCreateCart(sessionId?: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    // Ищем корзину пользователя
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                priceType: true,
                images: {
                  where: { isPrimary: true },
                  select: { url: true, alt: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  priceType: true,
                  images: {
                    where: { isPrimary: true },
                    select: { url: true, alt: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  } else if (sessionId) {
    // Гостевая корзина
    let cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                priceType: true,
                images: {
                  where: { isPrimary: true },
                  select: { url: true, alt: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  priceType: true,
                  images: {
                    where: { isPrimary: true },
                    select: { url: true, alt: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  return null;
}

/**
 * Добавить товар в корзину
 */
export async function addToCart(
  data: CartItemData & { priceSnapshot?: PriceSnapshot },
  sessionId?: string
) {
  const cart = await getOrCreateCart(sessionId);
  if (!cart) {
    throw new Error("Не удалось создать корзину");
  }

  // Проверяем, есть ли уже такой товар с такими же параметрами
  const existingItem = cart.items.find(
    (item) =>
      item.productId === data.productId &&
      item.width?.toString() === data.width?.toString() &&
      item.height?.toString() === data.height?.toString() &&
      JSON.stringify(item.selectedOptions) === JSON.stringify(data.selectedOptions)
  );

  if (existingItem) {
    // Обновляем количество
    return await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + data.quantity,
        priceSnapshot: data.priceSnapshot
          ? (data.priceSnapshot as unknown as Prisma.InputJsonValue)
          : undefined,
        updatedAt: new Date(),
      },
    });
  } else {
    // Создаём новую позицию
    return await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: data.productId,
        quantity: data.quantity,
        width: data.width ? new Prisma.Decimal(data.width) : null,
        height: data.height ? new Prisma.Decimal(data.height) : null,
        selectedOptions: data.selectedOptions
          ? (data.selectedOptions as unknown as Prisma.InputJsonValue)
          : undefined,
        priceSnapshot: data.priceSnapshot
          ? (data.priceSnapshot as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}

/**
 * Обновить количество товара в корзине
 */
export async function updateCartItem(itemId: string, quantity: number, priceSnapshot?: PriceSnapshot) {
  if (quantity <= 0) {
    return await prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  return await prisma.cartItem.update({
    where: { id: itemId },
    data: {
      quantity,
      priceSnapshot: priceSnapshot
        ? (priceSnapshot as unknown as Prisma.InputJsonValue)
        : undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Удалить товар из корзины
 */
export async function removeFromCart(itemId: string) {
  return await prisma.cartItem.delete({
    where: { id: itemId },
  });
}

/**
 * Очистить корзину
 */
export async function clearCart(sessionId?: string) {
  const cart = await getOrCreateCart(sessionId);
  if (!cart) return;

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });
}

/**
 * Получить корзину с подсчётом итогов
 */
export async function getCart(sessionId?: string) {
  const cart = await getOrCreateCart(sessionId);
  if (!cart) return null;

  const items = cart.items as unknown as CartItemWithProduct[];

  // Подсчитываем итоги на основе сохранённых priceSnapshot
  const totals = items.reduce(
    (acc, item) => {
      if (item.priceSnapshot) {
        const itemTotal = item.priceSnapshot.gross * item.quantity;
        const itemNet = item.priceSnapshot.net * item.quantity;
        const itemVat = item.priceSnapshot.vatAmount * item.quantity;

        acc.subtotal += itemNet;
        acc.vatAmount += itemVat;
        acc.total += itemTotal;
      }
      return acc;
    },
    { subtotal: 0, vatAmount: 0, total: 0 }
  );

  return {
    id: cart.id,
    items,
    totals,
  };
}

/**
 * Перенести гостевую корзину в корзину пользователя при входе
 */
export async function mergeGuestCart(guestSessionId: string, userId: string) {
  const guestCart = await prisma.cart.findUnique({
    where: { sessionId: guestSessionId },
    include: { items: true },
  });

  if (!guestCart || guestCart.items.length === 0) {
    return;
  }

  const userCart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // Переносим товары
  for (const item of guestCart.items) {
    // Проверяем дубликаты
    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: userCart.id,
        productId: item.productId,
        width: item.width,
        height: item.height,
        selectedOptions: item.selectedOptions ? { equals: item.selectedOptions } : undefined,
      },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity,
          width: item.width,
          height: item.height,
          selectedOptions: item.selectedOptions
            ? (item.selectedOptions as unknown as Prisma.InputJsonValue)
            : undefined,
          priceSnapshot: item.priceSnapshot
            ? (item.priceSnapshot as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }
  }

  // Удаляем гостевую корзину
  await prisma.cart.delete({
    where: { id: guestCart.id },
  });
}
