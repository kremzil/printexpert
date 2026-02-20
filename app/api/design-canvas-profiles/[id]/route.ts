import { NextRequest, NextResponse } from "next/server"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

type Params = {
  params: Promise<{ id: string }>
}

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : (value as number)
  return Number.isFinite(parsed) ? parsed : null
}

const PUTHandler = async (request: NextRequest, { params }: Params) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const prisma = getPrisma()
  const existing = await prisma.designCanvasProfile.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const body = await request.json()
  const sizeAid = body?.sizeAid === undefined
    ? undefined
    : typeof body.sizeAid === "string" && body.sizeAid.trim()
      ? body.sizeAid.trim()
      : null
  const sizeTermId = body?.sizeTermId === undefined
    ? undefined
    : typeof body.sizeTermId === "string" && body.sizeTermId.trim()
      ? body.sizeTermId.trim()
      : null
  const sizeLabel = body?.sizeLabel === undefined
    ? undefined
    : typeof body.sizeLabel === "string" && body.sizeLabel.trim()
      ? body.sizeLabel.trim()
      : null

  try {
    const updated = await prisma.designCanvasProfile.update({
      where: { id },
      data: {
        ...(body?.name !== undefined && {
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
        }),
        ...(body?.sortOrder !== undefined && {
          sortOrder: Math.round(Number(body.sortOrder)),
        }),
        ...(body?.isActive !== undefined && {
          isActive: Boolean(body.isActive),
        }),
        ...(sizeAid !== undefined && { sizeAid }),
        ...(sizeTermId !== undefined && { sizeTermId }),
        ...(sizeLabel !== undefined && { sizeLabel }),
        ...(body?.trimWidthMm !== undefined && {
          trimWidthMm: toFiniteNumber(body.trimWidthMm) ?? existing.trimWidthMm,
        }),
        ...(body?.trimHeightMm !== undefined && {
          trimHeightMm: toFiniteNumber(body.trimHeightMm) ?? existing.trimHeightMm,
        }),
        ...(body?.dpi !== undefined && {
          dpi: Math.max(1, Math.round(Number(body.dpi))),
        }),
        ...(body?.bgColor !== undefined && {
          bgColor: typeof body.bgColor === "string" && body.bgColor.trim() ? body.bgColor.trim() : existing.bgColor,
        }),
        ...(body?.colorProfile !== undefined && {
          colorProfile:
            typeof body.colorProfile === "string" && body.colorProfile.trim()
              ? body.colorProfile.trim()
              : existing.colorProfile,
        }),
        ...(body?.bleedTopMm !== undefined && {
          bleedTopMm: toFiniteNumber(body.bleedTopMm) ?? existing.bleedTopMm,
        }),
        ...(body?.bleedRightMm !== undefined && {
          bleedRightMm: toFiniteNumber(body.bleedRightMm) ?? existing.bleedRightMm,
        }),
        ...(body?.bleedBottomMm !== undefined && {
          bleedBottomMm: toFiniteNumber(body.bleedBottomMm) ?? existing.bleedBottomMm,
        }),
        ...(body?.bleedLeftMm !== undefined && {
          bleedLeftMm: toFiniteNumber(body.bleedLeftMm) ?? existing.bleedLeftMm,
        }),
        ...(body?.safeTopMm !== undefined && {
          safeTopMm: toFiniteNumber(body.safeTopMm) ?? existing.safeTopMm,
        }),
        ...(body?.safeRightMm !== undefined && {
          safeRightMm: toFiniteNumber(body.safeRightMm) ?? existing.safeRightMm,
        }),
        ...(body?.safeBottomMm !== undefined && {
          safeBottomMm: toFiniteNumber(body.safeBottomMm) ?? existing.safeBottomMm,
        }),
        ...(body?.safeLeftMm !== undefined && {
          safeLeftMm: toFiniteNumber(body.safeLeftMm) ?? existing.safeLeftMm,
        }),
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json(
      { error: "Canvas profil pre zvolenú veľkosť už existuje." },
      { status: 409 }
    )
  }
}

const DELETEHandler = async (_request: NextRequest, { params }: Params) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const prisma = getPrisma()
  const existing = await prisma.designCanvasProfile.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  await prisma.designCanvasProfile.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export const PUT = withObservedRoute("PUT /api/design-canvas-profiles/[id]", PUTHandler)
export const DELETE = withObservedRoute("DELETE /api/design-canvas-profiles/[id]", DELETEHandler)
