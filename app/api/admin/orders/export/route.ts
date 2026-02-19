import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"] as const;
const PAYMENT_STATUSES = ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const escapeCsvCell = (value: unknown) => {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const parseArrayParam = (value: string | null) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseDateInput = (value: string | null, isEnd?: boolean) => {
  if (!value) return null;
  const suffix = isEnd ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const GETHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  if (format !== "csv") {
    return NextResponse.json({ error: "Podporovaný formát je iba CSV." }, { status: 400 });
  }

  const selectedStatuses = parseArrayParam(searchParams.get("status")).filter((value) =>
    ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number])
  ) as Array<(typeof ORDER_STATUSES)[number]>;
  const selectedPaymentStatuses = parseArrayParam(searchParams.get("paymentStatus")).filter((value) =>
    PAYMENT_STATUSES.includes(value as (typeof PAYMENT_STATUSES)[number])
  ) as Array<(typeof PAYMENT_STATUSES)[number]>;

  const query = (searchParams.get("q") ?? "").trim();
  const fromDate = parseDateInput(searchParams.get("from"));
  const toDate = parseDateInput(searchParams.get("to"), true);
  const sort = searchParams.get("sort") ?? "newest";

  const where: Prisma.OrderWhereInput = {};

  if (selectedStatuses.length > 0) {
    where.status = { in: selectedStatuses };
  }
  if (selectedPaymentStatuses.length > 0) {
    where.paymentStatus = { in: selectedPaymentStatuses };
  }
  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }
  if (query) {
    where.OR = [
      { orderNumber: { contains: query, mode: "insensitive" } },
      { customerEmail: { contains: query, mode: "insensitive" } },
      { customerName: { contains: query, mode: "insensitive" } },
      { user: { email: { contains: query, mode: "insensitive" } } },
    ];
  }

  const orderBy = (() => {
    if (sort === "oldest") return [{ createdAt: "asc" }] as Prisma.OrderOrderByWithRelationInput[];
    if (sort === "status") return [{ status: "asc" }, { createdAt: "desc" }] as Prisma.OrderOrderByWithRelationInput[];
    return [{ createdAt: "desc" }] as Prisma.OrderOrderByWithRelationInput[];
  })();

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      total: true,
      customerName: true,
      customerEmail: true,
      deliveryMethod: true,
      paymentMethod: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  const headers = [
    "id",
    "orderNumber",
    "status",
    "paymentStatus",
    "customerName",
    "customerEmail",
    "itemsCount",
    "total",
    "deliveryMethod",
    "paymentMethod",
    "createdAt",
  ];

  const csvRows = orders.map((order) =>
    [
      order.id,
      order.orderNumber,
      order.status,
      order.paymentStatus,
      order.customerName,
      order.customerEmail,
      String(order._count.items),
      String(Number(order.total)),
      order.deliveryMethod ?? "",
      order.paymentMethod ?? "",
      order.createdAt.toISOString(),
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const csv = [headers.map(escapeCsvCell).join(","), ...csvRows].join("\n");
  const fileName = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
};

export const GET = withObservedRoute("GET /api/admin/orders/export", GETHandler);

