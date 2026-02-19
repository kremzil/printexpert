import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

type Params = {
  params: Promise<{ id: string }>
}

// PUT /api/design-templates/[id] — update template (admin only)
const PUTHandler = async (request: NextRequest, { params }: Params) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, elements, thumbnailUrl, isDefault, sortOrder } = body

  const prisma = getPrisma()

  const existing = await prisma.designTemplate.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  // If setting as default, unset other defaults
  if (isDefault && !existing.isDefault) {
    await prisma.designTemplate.updateMany({
      where: { productId: existing.productId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.designTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(elements !== undefined && { elements }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      ...(isDefault !== undefined && { isDefault }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/design-templates/[id] — delete template (admin only)
const DELETEHandler = async (_request: NextRequest, { params }: Params) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const prisma = getPrisma()

  const existing = await prisma.designTemplate.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  await prisma.designTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

export const PUT = withObservedRoute("PUT /api/design-templates/[id]", PUTHandler);
export const DELETE = withObservedRoute("DELETE /api/design-templates/[id]", DELETEHandler);



