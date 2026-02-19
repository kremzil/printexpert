import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

// GET /api/design-templates?productId=xxx
const GETHandler = async (request: NextRequest) => {
  const productId = request.nextUrl.searchParams.get("productId")
  if (!productId) {
    return NextResponse.json(
      { error: "productId is required" },
      { status: 400 }
    )
  }

  const prisma = getPrisma()
  const templates = await prisma.designTemplate.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      elements: true,
      thumbnailUrl: true,
      isDefault: true,
      sortOrder: true,
    },
  })

  return NextResponse.json(templates)
}

// POST /api/design-templates — create a new template (admin only)
const POSTHandler = async (request: NextRequest) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { productId, name, elements, thumbnailUrl, isDefault } = body

  if (!productId || !name || !elements) {
    return NextResponse.json(
      { error: "productId, name, and elements are required" },
      { status: 400 }
    )
  }

  const prisma = getPrisma()

  // If setting as default, unset other defaults first
  if (isDefault) {
    await prisma.designTemplate.updateMany({
      where: { productId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const template = await prisma.designTemplate.create({
    data: {
      productId,
      name,
      elements,
      thumbnailUrl: thumbnailUrl || null,
      isDefault: isDefault ?? false,
    },
  })

  return NextResponse.json(template, { status: 201 })
}

export const GET = withObservedRoute("GET /api/design-templates", GETHandler);
export const POST = withObservedRoute("POST /api/design-templates", POSTHandler);



