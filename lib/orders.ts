"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculate } from "@/lib/pricing";
import { resolveAudienceContext } from "@/lib/audience-context";
import { getCart } from "@/lib/cart";
import { Prisma } from "@/lib/generated/prisma";
import type { CheckoutData, OrderData } from "@/types/order";

/**
 * Генерация номера заказа
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function parseSelectionsFromOptions(
  selectedOptions: unknown
): Record<string, Record<string, string>> | undefined {
  if (!selectedOptions || typeof selectedOptions !== "object" || Array.isArray(selectedOptions)) {
    return undefined;
  }

  const entries = Object.entries(selectedOptions as Record<string, unknown>).filter(
    ([key, value]) => !key.startsWith("_") && Boolean(value) && typeof value === "object" && !Array.isArray(value)
  );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, Record<string, string>>;
}

function parseProductionSpeedPercent(selectedOptions: unknown): number {
  if (!selectedOptions || typeof selectedOptions !== "object" || Array.isArray(selectedOptions)) {
    return 0;
  }

  const raw = (selectedOptions as Record<string, unknown>)._productionSpeed;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return 0;
  }

  const percent = Number((raw as { percent?: unknown }).percent ?? 0);
  return Number.isFinite(percent) ? percent : 0;
}

type PreparedOrderItem = {
  sourceCartItemId: string;
  data: Prisma.OrderItemUncheckedCreateWithoutOrderInput;
};

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
  const preparedOrderItems: PreparedOrderItem[] = [];
  let subtotal = new Prisma.Decimal(0);
  let vatAmount = new Prisma.Decimal(0);
  let total = new Prisma.Decimal(0);

  for (const item of cart.items) {
    // Серверный пересчёт цены
    const selections = parseSelectionsFromOptions(item.selectedOptions);
    const productionSpeedPercent = parseProductionSpeedPercent(item.selectedOptions);

    const freshPrice = await calculate(
      item.productId,
      {
        quantity: item.quantity,
        width: item.width ? parseFloat(item.width.toString()) : null,
        height: item.height ? parseFloat(item.height.toString()) : null,
        selections,
        productionSpeedPercent,
      },
      audienceContext
    );

    const itemNet = new Prisma.Decimal(freshPrice.net);
    const itemVat = new Prisma.Decimal(freshPrice.vatAmount);
    const itemGross = new Prisma.Decimal(freshPrice.gross);

    subtotal = subtotal.add(itemNet);
    vatAmount = vatAmount.add(itemVat);
    total = total.add(itemGross);

    preparedOrderItems.push({
      sourceCartItemId: item.id,
      data: {
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        width: item.width,
        height: item.height,
        selectedOptions: item.selectedOptions
          ? (item.selectedOptions as unknown as Prisma.InputJsonValue)
          : undefined,
        priceNet: itemNet,
        priceVat: itemVat,
        priceGross: itemGross,
        priceSnapshot: freshPrice as unknown as Prisma.InputJsonValue,
        designData: item.designData
          ? (item.designData as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  const { order, itemMappings } = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
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
        deliveryMethod: checkoutData.deliveryMethod ?? "DPD_COURIER",
        paymentMethod: checkoutData.paymentMethod ?? "STRIPE",
        dpdProduct: checkoutData.dpdProduct ?? null,
        pickupPoint: checkoutData.pickupPoint
          ? (checkoutData.pickupPoint as unknown as Prisma.InputJsonValue)
          : undefined,
        shippingAddress: checkoutData.shippingAddress
          ? (checkoutData.shippingAddress as unknown as Prisma.InputJsonValue)
          : undefined,
        billingAddress: checkoutData.billingAddress
          ? (checkoutData.billingAddress as unknown as Prisma.InputJsonValue)
          : undefined,
        codAmount:
          checkoutData.paymentMethod === "COD" ? total : undefined,
        codCurrency:
          checkoutData.paymentMethod === "COD" ? "EUR" : undefined,
        notes: checkoutData.notes || null,
      },
      select: {
        id: true,
      },
    });

    const mappings: Array<{ cartItemId: string; orderItemId: string }> = [];

    for (const preparedItem of preparedOrderItems) {
      const createdItem = await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          ...preparedItem.data,
        },
        select: {
          id: true,
        },
      });
      mappings.push({
        cartItemId: preparedItem.sourceCartItemId,
        orderItemId: createdItem.id,
      });
    }

    const fullOrder = await tx.order.findUnique({
      where: { id: createdOrder.id },
      include: {
        items: true,
      },
    });

    if (!fullOrder) {
      throw new Error("Objednávku sa nepodarilo načítať po vytvorení.");
    }

    return {
      order: fullOrder,
      itemMappings: mappings,
    };
  });

  // Корзина очищается на клиенте после успешной оплаты (order-success)

  return {
    ...(order as unknown as OrderData),
    itemMappings,
  };
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
    codAmount: order.codAmount ? Number(order.codAmount) : null,
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
      items: {
        include: {
          product: {
            select: {
              priceType: true,
            },
          },
        },
      },
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
    codAmount: order.codAmount ? Number(order.codAmount) : null,
    items: order.items.map(({ product, ...item }) => ({
      ...item,
      productPriceType: product?.priceType ?? null,
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
      items: {
        include: {
          product: {
            select: {
              priceType: true,
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    codAmount: order.codAmount ? Number(order.codAmount) : null,
    items: order.items.map(({ product, ...item }) => ({
      ...item,
      productPriceType: product?.priceType ?? null,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  } as unknown as OrderData;
}
