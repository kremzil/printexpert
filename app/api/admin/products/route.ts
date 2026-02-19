import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const GETHandler = async (request: NextRequest) => {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const audience = searchParams.get("audience")
  const audienceFilter =
    audience === "b2b"
      ? { showInB2b: true }
      : audience === "b2c"
        ? { showInB2c: true }
        : null

  const products = await prisma.product.findMany({
    where: audienceFilter
      ? {
          isActive: true,
          ...audienceFilter,
          category: {
            isActive: true,
            ...audienceFilter,
          },
        }
      : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      images: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          url: true,
          alt: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  return NextResponse.json(products)
}

export const GET = withObservedRoute("GET /api/admin/products", GETHandler);



