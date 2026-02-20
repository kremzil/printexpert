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
  const { name, elements, thumbnailUrl, isDefault, sortOrder, canvasProfileId } = body

  const prisma = getPrisma()

  const existing = await prisma.designTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      productId: true,
      canvasProfileId: true,
      isDefault: true,
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  let nextCanvasProfileId = existing.canvasProfileId
  if (canvasProfileId !== undefined) {
    if (typeof canvasProfileId !== "string" || !canvasProfileId.trim()) {
      return NextResponse.json({ error: "Invalid canvasProfileId" }, { status: 400 })
    }
    const profile = await prisma.designCanvasProfile.findUnique({
      where: { id: canvasProfileId },
      select: { id: true, productId: true },
    })
    if (!profile || profile.productId !== existing.productId) {
      return NextResponse.json(
        { error: "Invalid canvas profile for this product" },
        { status: 400 }
      )
    }
    nextCanvasProfileId = profile.id
  }

  // If setting as default, unset other defaults
  if (isDefault && (!existing.isDefault || nextCanvasProfileId !== existing.canvasProfileId)) {
    await prisma.designTemplate.updateMany({
      where: { canvasProfileId: nextCanvasProfileId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.designTemplate.update({
    where: { id },
    data: {
      ...(canvasProfileId !== undefined && { canvasProfileId: nextCanvasProfileId }),
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



