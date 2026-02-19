import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const DEFAULT_COLUMNS = [
  "name",
  "slug",
  "category",
  "priceFrom",
  "isActive",
  "showInB2b",
  "showInB2c",
  "orderItems",
] as const;

const escapeCsvCell = (value: unknown) => {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","));
  return [headerLine, ...bodyLines].join("\n");
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

  const q = (searchParams.get("q") ?? "").trim();
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const audience = searchParams.get("audience");
  const columnsRaw = searchParams.get("columns");

  const columns =
    columnsRaw && columnsRaw.length > 0
      ? columnsRaw.split(",").map((value) => value.trim()).filter(Boolean)
      : [...DEFAULT_COLUMNS];

  const products = await prisma.product.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(category && category !== "all" ? { category: { slug: category } } : {}),
      ...(audience === "b2b" ? { showInB2b: true } : {}),
      ...(audience === "b2c" ? { showInB2c: true } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      showInB2b: true,
      showInB2c: true,
      priceFrom: true,
      updatedAt: true,
      category: {
        select: { name: true, slug: true },
      },
      _count: {
        select: { orderItems: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category?.name ?? "",
    categorySlug: product.category?.slug ?? "",
    priceFrom: product.priceFrom ? Number(product.priceFrom) : "",
    isActive: product.isActive ? "1" : "0",
    showInB2b: product.showInB2b ? "1" : "0",
    showInB2c: product.showInB2c ? "1" : "0",
    orderItems: product._count.orderItems,
    updatedAt: product.updatedAt.toISOString(),
  }));

  const safeHeaders = columns.length > 0 ? columns : [...DEFAULT_COLUMNS];
  const csv = toCsv(safeHeaders, rows);
  const fileName = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
};

export const GET = withObservedRoute("GET /api/admin/products/export", GETHandler);

