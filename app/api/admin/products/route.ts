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
  const compact = searchParams.get("compact") === "1"
  const query = (searchParams.get("q") ?? "").trim()
  const rawLimit = Number(searchParams.get("limit") ?? (compact ? "120" : "0"))
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.max(Math.round(rawLimit), 1), 300)
      : undefined
  const audienceFilter =
    audience === "b2b"
      ? { showInB2b: true }
      : audience === "b2c"
        ? { showInB2c: true }
        : null

  const where = audienceFilter
    ? {
        isActive: true,
        ...audienceFilter,
        category: {
          isActive: true,
          ...audienceFilter,
        },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { slug: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
    : {
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { slug: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }

  const products = await prisma.product.findMany({
    where,
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
      ...(compact
        ? {}
        : {
            images: {
              take: 1,
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              select: {
                url: true,
                alt: true,
              },
            },
          }),
    },
    orderBy: {
      name: "asc",
    },
    ...(limit ? { take: limit } : {}),
  })

  return NextResponse.json(products)
}

export const GET = withObservedRoute("GET /api/admin/products", GETHandler);



