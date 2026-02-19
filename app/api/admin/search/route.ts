import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({
      products: [],
      orders: [],
      users: [],
    });
  }

  const [products, orders, users] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      label: product.name,
      sublabel: `/${product.slug}`,
      href: `/admin/products/${product.id}`,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      label: `#${order.orderNumber}`,
      sublabel: order.customerName,
      href: `/admin/orders/${order.id}`,
    })),
    users: users.map((user) => ({
      id: user.id,
      label: user.name || user.email,
      sublabel: user.email,
      href: "/admin/users",
    })),
  });
};

export const GET = withObservedRoute("GET /api/admin/search", GETHandler);

