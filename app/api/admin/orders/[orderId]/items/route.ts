import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { getShopSettings } from "@/lib/shop-settings";
import {
  calculateDpdCourierShippingGross,
  splitGrossByVat,
} from "@/lib/delivery-pricing";

type ItemInput = {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  unitPriceNet?: number;
  vatRatePercent?: number;
  width?: number | null;
  height?: number | null;
  selectedOptions?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const PATCHHandler = async (
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    const body = await req.json().catch(() => null);

    if (!isRecord(body) || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const incomingItems = (body.items as ItemInput[]).map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : null,
      productId:
        typeof item.productId === "string" && item.productId.trim() ? item.productId.trim() : null,
      name: typeof item.name === "string" ? item.name.trim() : "",
      quantity: Number(item.quantity),
      unitPriceNet: Number(item.unitPriceNet),
      vatRatePercent: Number(item.vatRatePercent),
      width:
        item.width === null || item.width === undefined ? null : Number(item.width),
      height:
        item.height === null || item.height === undefined ? null : Number(item.height),
      selectedOptions:
        item.selectedOptions && isRecord(item.selectedOptions)
          ? (item.selectedOptions as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    }));

    if (incomingItems.length === 0) {
      return NextResponse.json(
        { error: "Objednávka musí obsahovať aspoň jednu položku." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryMethod: true,
        paymentMethod: true,
        items: {
          select: {
            id: true,
            productId: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const existingById = new Map(order.items.map((item) => [item.id, item]));
    const productIds = Array.from(
      new Set(incomingItems.map((item) => item.productId).filter((id): id is string => Boolean(id)))
    );

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const normalized = incomingItems.map((item, index) => {
      if (!item.name) {
        throw new Error(`Položka #${index + 1}: názov je povinný.`);
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error(`Položka #${index + 1}: množstvo musí byť väčšie ako 0.`);
      }
      if (!Number.isFinite(item.unitPriceNet) || item.unitPriceNet < 0) {
        throw new Error(`Položka #${index + 1}: cena bez DPH musí byť 0 alebo viac.`);
      }
      if (
        !Number.isFinite(item.vatRatePercent) ||
        item.vatRatePercent < 0 ||
        item.vatRatePercent > 100
      ) {
        throw new Error(`Položka #${index + 1}: DPH musí byť medzi 0 a 100.`);
      }
      if (item.width !== null && (!Number.isFinite(item.width) || item.width <= 0)) {
        throw new Error(`Položka #${index + 1}: šírka musí byť väčšia ako 0.`);
      }
      if (item.height !== null && (!Number.isFinite(item.height) || item.height <= 0)) {
        throw new Error(`Položka #${index + 1}: výška musí byť väčšia ako 0.`);
      }

      const resolvedProductId =
        item.productId ?? (item.id ? existingById.get(item.id)?.productId ?? null : null);
      if (!resolvedProductId || !productMap.has(resolvedProductId)) {
        throw new Error(`Položka #${index + 1}: neplatný produkt.`);
      }

      const quantity = Math.round(item.quantity);
      const unitPriceNet = roundMoney(item.unitPriceNet);
      const vatRate = item.vatRatePercent / 100;
      const netPrice = roundMoney(unitPriceNet * quantity);
      const vatAmount = roundMoney(netPrice * vatRate);
      const grossPrice = roundMoney(netPrice + vatAmount);

      return {
        id: item.id,
        productId: resolvedProductId,
        productName: item.name,
        quantity,
        unitPriceNet,
        vatRate,
        netPrice,
        vatAmount,
        grossPrice,
        width: item.width,
        height: item.height,
        selectedOptions: item.selectedOptions,
      };
    });

    const productsSubtotal = roundMoney(
      normalized.reduce((sum, item) => sum + item.netPrice, 0)
    );
    const productsVat = roundMoney(normalized.reduce((sum, item) => sum + item.vatAmount, 0));
    const productsTotal = roundMoney(normalized.reduce((sum, item) => sum + item.grossPrice, 0));

    const settings = await getShopSettings();
    const shippingGross = calculateDpdCourierShippingGross({
      deliveryMethod: order.deliveryMethod ?? "DPD_COURIER",
      productsSubtotal,
      courierPrice: settings.dpdSettings.courierPrice,
      freeShippingFrom: settings.dpdSettings.courierFreeFrom,
    });
    const shipping = splitGrossByVat(shippingGross, settings.vatRate);

    const subtotal = roundMoney(productsSubtotal + shipping.net);
    const vatAmount = roundMoney(productsVat + shipping.vat);
    const total = roundMoney(productsTotal + shipping.gross);

    const incomingExistingIds = new Set(
      normalized.map((item) => item.id).filter((id): id is string => Boolean(id))
    );
    const toDeleteIds = order.items
      .filter((item) => !incomingExistingIds.has(item.id))
      .map((item) => item.id);

    const updated = await prisma.$transaction(async (tx) => {
      if (toDeleteIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: {
            orderId,
            id: { in: toDeleteIds },
          },
        });
      }

      for (const item of normalized) {
        const priceSnapshot = {
          net: item.netPrice,
          vatAmount: item.vatAmount,
          gross: item.grossPrice,
          unitNet: item.unitPriceNet,
          vatRate: item.vatRate,
        } as Prisma.InputJsonValue;

        if (item.id && existingById.has(item.id)) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              width: item.width === null ? null : new Prisma.Decimal(item.width.toFixed(2)),
              height: item.height === null ? null : new Prisma.Decimal(item.height.toFixed(2)),
              selectedOptions: item.selectedOptions,
              priceNet: new Prisma.Decimal(item.netPrice.toFixed(2)),
              priceVat: new Prisma.Decimal(item.vatAmount.toFixed(2)),
              priceGross: new Prisma.Decimal(item.grossPrice.toFixed(2)),
              priceSnapshot,
            },
          });
          continue;
        }

        await tx.orderItem.create({
          data: {
            orderId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            width: item.width === null ? null : new Prisma.Decimal(item.width.toFixed(2)),
            height: item.height === null ? null : new Prisma.Decimal(item.height.toFixed(2)),
            selectedOptions: item.selectedOptions,
            priceNet: new Prisma.Decimal(item.netPrice.toFixed(2)),
            priceVat: new Prisma.Decimal(item.vatAmount.toFixed(2)),
            priceGross: new Prisma.Decimal(item.grossPrice.toFixed(2)),
            priceSnapshot,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          vatAmount: new Prisma.Decimal(vatAmount.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          codAmount:
            order.paymentMethod === "COD" ? new Prisma.Decimal(total.toFixed(2)) : null,
          codCurrency: order.paymentMethod === "COD" ? "EUR" : null,
        },
        include: {
          items: {
            include: {
              product: {
                select: { priceType: true },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      return updatedOrder;
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        subtotal: Number(updated.subtotal),
        vatAmount: Number(updated.vatAmount),
        total: Number(updated.total),
        items: updated.items.map(({ product, ...item }) => ({
          ...item,
          productPriceType: product?.priceType ?? null,
          width: item.width ? Number(item.width) : null,
          height: item.height ? Number(item.height) : null,
          priceNet: Number(item.priceNet),
          priceVat: Number(item.priceVat),
          priceGross: Number(item.priceGross),
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepodarilo sa uložiť položky.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};

export const PATCH = withObservedRoute(
  "PATCH /api/admin/orders/[orderId]/items",
  PATCHHandler
);
