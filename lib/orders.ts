"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculate } from "@/lib/pricing";
import { resolveAudienceContext } from "@/lib/audience-context";
import { getCart, clearCart } from "@/lib/cart";
import { Prisma } from "@/lib/generated/prisma";import type { JsonValue } from "@/lib/generated/prisma/runtime/library";import type { CheckoutData, OrderData } from "@/types/order";

/**
 * Генерация номера заказа
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Создать заказ из корзины
 */
export async function createOrder(
  checkoutData: CheckoutData,
  sessionId?: string
): Promise<OrderData> {
  const session = await auth();
  const userId = session?.user?.id;
  const audienceContext = await resolveAudienceContext();

  // Получаем корзину
  const cart = await getCart(sessionId);
  if (!cart || cart.items.length === 0) {
    throw new Error("Košík je prázdny");
  }

  // Пересчитываем все цены на сервере для финальной точности
  const orderItems = [];
  let subtotal = new Prisma.Decimal(0);
  let vatAmount = new Prisma.Decimal(0);
  let total = new Prisma.Decimal(0);

  for (const item of cart.items) {
    // Серверный пересчёт цены
    const freshPrice = await calculate(
      item.productId,
      {
        quantity: item.quantity,
        width: item.width ? parseFloat(item.width.toString()) : null,
        height: item.height ? parseFloat(item.height.toString()) : null,
        selections: item.selectedOptions || {},
      },
      audienceContext
    );

    const itemNet = new Prisma.Decimal(freshPrice.net);
    const itemVat = new Prisma.Decimal(freshPrice.vatAmount);
    const itemGross = new Prisma.Decimal(freshPrice.gross);

    subtotal = subtotal.add(itemNet);
    vatAmount = vatAmount.add(itemVat);
    total = total.add(itemGross);

    orderItems.push({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      width: item.width,
      height: item.height,
      selectedOptions: item.selectedOptions ? (item.selectedOptions as JsonValue) : undefined,
      priceNet: itemNet,
      priceVat: itemVat,
      priceGross: itemGross,
      priceSnapshot: freshPrice as JsonValue,
    });
  }

  // Создаём заказ
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: userId || undefined,
      audience: audienceContext.audience,
      status: "PENDING",
      subtotal,
      vatAmount,
      total,
      customerName: checkoutData.customerName,
      customerEmail: checkoutData.customerEmail,
      customerPhone: checkoutData.customerPhone || null,
      shippingAddress: checkoutData.shippingAddress ? (checkoutData.shippingAddress as JsonValue) : undefined,
      billingAddress: checkoutData.billingAddress ? (checkoutData.billingAddress as JsonValue) : undefined,
      notes: checkoutData.notes || null,
      items: {
        create: orderItems,
      },
    },
    include: {
      items: true,
    },
  });

  // Очищаем корзину после успешного создания заказа
  await clearCart(sessionId);

  return order as unknown as OrderData;
}

/**
 * Получить заказы пользователя
 */
export async function getUserOrders(): Promise<OrderData[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Vyžaduje sa prihlásenie");
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Сериализуем Decimal в number
  return orders.map(order => ({
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    items: order.items.map(item => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  })) as unknown as OrderData[];
}

/**
 * Получить заказ по ID
 */
export async function getOrderById(orderId: string): Promise<OrderData | null> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Vyžaduje sa prihlásenie");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  // Проверяем, что заказ принадлежит пользователю
  if (order && order.userId !== session.user.id) {
    throw new Error("Prístup zamietnutý");
  }

  if (!order) {
    return null;
  }

  // Сериализуем Decimal в number
  return {
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    items: order.items.map(item => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  } as unknown as OrderData;
}

/**
 * Получить заказ по номеру заказа
 */
export async function getOrderByNumber(orderNumber: string): Promise<OrderData | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
    },
  });

  if (!order) return null;

  return {
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    items: order.items.map(item => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  } as unknown as OrderData;
}
