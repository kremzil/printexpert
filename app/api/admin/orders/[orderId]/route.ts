import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const ALLOWED_PAYMENT_METHODS = new Set(["STRIPE", "BANK_TRANSFER", "COD"]);
const ALLOWED_DELIVERY_METHODS = new Set(["DPD_COURIER", "DPD_PICKUP", "PERSONAL_PICKUP"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value: unknown, maxLength = 255): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeNullableText = (value: unknown, maxLength = 255): string | null => {
  if (value === null || value === undefined) return null;
  return normalizeText(value, maxLength);
};

const normalizeAddress = (
  raw: unknown,
  includeTaxFields: boolean
): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  if (raw === null) {
    return Prisma.JsonNull;
  }

  if (!isRecord(raw)) {
    throw new Error("Invalid address payload");
  }

  const payload: Record<string, string> = {};
  const name = normalizeText(raw.name, 200);
  const street = normalizeText(raw.street, 255);
  const postalCode = normalizeText(raw.postalCode, 30);
  const city = normalizeText(raw.city, 120);
  const country = normalizeText(raw.country, 120);

  if (name) payload.name = name;
  if (street) payload.street = street;
  if (postalCode) payload.postalCode = postalCode;
  if (city) payload.city = city;
  if (country) payload.country = country;

  if (includeTaxFields) {
    const ico = normalizeText(raw.ico, 30);
    const dic = normalizeText(raw.dic, 30);
    const icDph = normalizeText(raw.icDph, 30);
    if (ico) payload.ico = ico;
    if (dic) payload.dic = dic;
    if (icDph) payload.icDph = icDph;
  }

  if (Object.keys(payload).length === 0) {
    return Prisma.JsonNull;
  }

  return payload as Prisma.InputJsonValue;
};

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

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, total: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const data: Prisma.OrderUpdateInput = {};
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

    if (hasOwn("customerName")) {
      const customerName = normalizeText(body.customerName, 200);
      if (!customerName) {
        return NextResponse.json({ error: "Meno zákazníka je povinné." }, { status: 400 });
      }
      data.customerName = customerName;
    }

    if (hasOwn("customerEmail")) {
      const customerEmail = normalizeText(body.customerEmail, 255);
      if (!customerEmail) {
        return NextResponse.json({ error: "E-mail zákazníka je povinný." }, { status: 400 });
      }
      data.customerEmail = customerEmail;
    }

    if (hasOwn("customerPhone")) {
      data.customerPhone = normalizeNullableText(body.customerPhone, 50);
    }

    if (hasOwn("paymentMethod")) {
      const paymentMethod = normalizeText(body.paymentMethod, 32);
      if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        return NextResponse.json({ error: "Neplatná metóda platby." }, { status: 400 });
      }
      data.paymentMethod = paymentMethod as "STRIPE" | "BANK_TRANSFER" | "COD";
      if (paymentMethod === "COD") {
        data.codAmount = existingOrder.total;
        data.codCurrency = "EUR";
      } else {
        data.codAmount = null;
        data.codCurrency = null;
      }
    }

    if (hasOwn("deliveryMethod")) {
      const deliveryMethod = normalizeText(body.deliveryMethod, 32);
      if (!deliveryMethod || !ALLOWED_DELIVERY_METHODS.has(deliveryMethod)) {
        return NextResponse.json({ error: "Neplatná metóda doručenia." }, { status: 400 });
      }
      data.deliveryMethod = deliveryMethod as "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP";
    }

    if (hasOwn("billingAddress")) {
      try {
        data.billingAddress = normalizeAddress(body.billingAddress, true);
      } catch {
        return NextResponse.json({ error: "Neplatná fakturačná adresa." }, { status: 400 });
      }
    }

    if (hasOwn("shippingAddress")) {
      try {
        data.shippingAddress = normalizeAddress(body.shippingAddress, false);
      } catch {
        return NextResponse.json({ error: "Neplatná dodacia adresa." }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data,
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        paymentMethod: true,
        deliveryMethod: true,
        billingAddress: true,
        shippingAddress: true,
      },
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Error updating admin order invoice fields:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

const DELETEHandler = async (
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const DELETE = withObservedRoute(
  "DELETE /api/admin/orders/[orderId]",
  DELETEHandler
);

export const PATCH = withObservedRoute(
  "PATCH /api/admin/orders/[orderId]",
  PATCHHandler
);
