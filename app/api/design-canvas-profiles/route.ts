import { NextRequest, NextResponse } from "next/server"
import { withObservedRoute } from "@/lib/observability/with-observed-route"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "string" ? Number(value) : (value as number)
  return Number.isFinite(parsed) ? parsed : fallback
}

const GETHandler = async (request: NextRequest) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const productId = request.nextUrl.searchParams.get("productId")
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const prisma = getPrisma()
  const profiles = await prisma.designCanvasProfile.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      templates: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          productId: true,
          canvasProfileId: true,
          name: true,
          elements: true,
          thumbnailUrl: true,
          isDefault: true,
          sortOrder: true,
        },
      },
    },
  })

  return NextResponse.json(profiles)
}

const POSTHandler = async (request: NextRequest) => {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const productId = typeof body?.productId === "string" ? body.productId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const sizeAid = typeof body?.sizeAid === "string" && body.sizeAid.trim() ? body.sizeAid.trim() : null
  const sizeTermId =
    typeof body?.sizeTermId === "string" && body.sizeTermId.trim() ? body.sizeTermId.trim() : null
  const sizeLabel =
    typeof body?.sizeLabel === "string" && body.sizeLabel.trim() ? body.sizeLabel.trim() : null

  if (!productId || !name) {
    return NextResponse.json({ error: "productId and name are required" }, { status: 400 })
  }

  const prisma = getPrisma()
  const existingCount = await prisma.designCanvasProfile.count({ where: { productId } })

  try {
    const created = await prisma.designCanvasProfile.create({
      data: {
        productId,
        name,
        sizeAid,
        sizeTermId,
        sizeLabel,
        trimWidthMm: toFiniteNumber(body?.trimWidthMm, 0),
        trimHeightMm: toFiniteNumber(body?.trimHeightMm, 0),
        dpi: Math.max(1, Math.round(toFiniteNumber(body?.dpi, 300))),
        bgColor:
          typeof body?.bgColor === "string" && body.bgColor.trim()
            ? body.bgColor.trim()
            : "#ffffff",
        colorProfile:
          typeof body?.colorProfile === "string" && body.colorProfile.trim()
            ? body.colorProfile.trim()
            : "CMYK",
        bleedTopMm: toFiniteNumber(body?.bleedTopMm, 0),
        bleedRightMm: toFiniteNumber(body?.bleedRightMm, 0),
        bleedBottomMm: toFiniteNumber(body?.bleedBottomMm, 0),
        bleedLeftMm: toFiniteNumber(body?.bleedLeftMm, 0),
        safeTopMm: toFiniteNumber(body?.safeTopMm, 0),
        safeRightMm: toFiniteNumber(body?.safeRightMm, 0),
        safeBottomMm: toFiniteNumber(body?.safeBottomMm, 0),
        safeLeftMm: toFiniteNumber(body?.safeLeftMm, 0),
        sortOrder: Number.isFinite(body?.sortOrder) ? Math.round(Number(body.sortOrder)) : existingCount,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Canvas profil pre zvolenú veľkosť už existuje." },
      { status: 409 }
    )
  }
}

export const GET = withObservedRoute("GET /api/design-canvas-profiles", GETHandler)
export const POST = withObservedRoute("POST /api/design-canvas-profiles", POSTHandler)
