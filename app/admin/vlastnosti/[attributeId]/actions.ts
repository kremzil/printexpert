"use server"

import { revalidatePath, updateTag } from "next/cache"

import { resolveAudienceContext } from "@/lib/audience-context"
import { getPrisma } from "@/lib/prisma"

type CreateTermInput = {
  attributeId: number
  attributeName: string
}

type DeleteTermInput = {
  attributeId: number
  termId: number
  termTaxonomyId: number
}
type UpdateTermOrderInput = {
  attributeId: number
  attributeName: string
  termId: number
}

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

const getAudienceTag = async () => {
  const { audience } = await resolveAudienceContext()
  return `audience:${audience}`
}

export async function createTerm(
  input: CreateTermInput,
  formData: FormData
) {
  const prisma = getPrisma()
  const name = String(formData.get("name") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()

  if (!name) {
    return
  }

  const slug = normalizeSlug(rawSlug || name)

  const [latestTerm, latestTax] = await Promise.all([
    prisma.wpTerm.findFirst({
      orderBy: { termId: "desc" },
      select: { termId: true },
    }),
    prisma.wpTermTaxonomy.findFirst({
      orderBy: { termTaxonomyId: "desc" },
      select: { termTaxonomyId: true },
    }),
  ])

  const termId = (latestTerm?.termId ?? 0) + 1
  const termTaxonomyId = (latestTax?.termTaxonomyId ?? 0) + 1
  const taxonomy = `pa_${input.attributeName}`

  await prisma.$transaction([
    prisma.wpTerm.create({
      data: {
        termId,
        name,
        slug,
        termGroup: null,
      },
    }),
    prisma.wpTermTaxonomy.create({
      data: {
        termTaxonomyId,
        termId,
        taxonomy,
        description: null,
        parent: 0,
        count: 0,
      },
    }),
  ])

  const audienceTag = await getAudienceTag()
  updateTag("attributes")
  updateTag(audienceTag)
  revalidatePath(`/admin/vlastnosti/${input.attributeId}`)
}

export async function deleteTerm(input: DeleteTermInput) {
  const prisma = getPrisma()

  await prisma.$transaction(async (tx) => {
    await tx.wpTermRelationship.deleteMany({
      where: { termTaxonomyId: input.termTaxonomyId },
    })
    await tx.wpTermTaxonomy.delete({
      where: { termTaxonomyId: input.termTaxonomyId },
    })

    const remaining = await tx.wpTermTaxonomy.count({
      where: { termId: input.termId },
    })
    if (remaining === 0) {
      await tx.wpTermMeta.deleteMany({
        where: { termId: input.termId },
      })
      await tx.wpTerm.delete({
        where: { termId: input.termId },
      })
    }
  })

  const audienceTag = await getAudienceTag()
  updateTag("attributes")
  updateTag(audienceTag)
  revalidatePath(`/admin/vlastnosti/${input.attributeId}`)
}

export async function updateTermOrder(
  input: UpdateTermOrderInput,
  formData: FormData
) {
  const prisma = getPrisma()
  const orderRaw = String(formData.get("order") ?? "").trim()
  const orderValue =
    orderRaw === "" ? null : Number.isNaN(Number(orderRaw)) ? null : Number(orderRaw)

  const metaKey = `order_pa_${input.attributeName}`
  const existing = await prisma.wpTermMeta.findFirst({
    where: { termId: input.termId, metaKey },
    select: { metaId: true },
    orderBy: { metaId: "desc" },
  })

  if (orderValue === null) {
    if (existing?.metaId) {
      await prisma.wpTermMeta.delete({
        where: { metaId: existing.metaId },
      })
    }
  } else if (existing?.metaId) {
    await prisma.wpTermMeta.update({
      where: { metaId: existing.metaId },
      data: { metaValue: String(orderValue) },
    })
  } else {
    const latestMeta = await prisma.wpTermMeta.findFirst({
      orderBy: { metaId: "desc" },
      select: { metaId: true },
    })
    const nextMetaId = (latestMeta?.metaId ?? 0) + 1
    await prisma.wpTermMeta.create({
      data: {
        metaId: nextMetaId,
        termId: input.termId,
        metaKey,
        metaValue: String(orderValue),
      },
    })
  }

  const audienceTag = await getAudienceTag()
  updateTag("attributes")
  updateTag(audienceTag)
  revalidatePath(`/admin/vlastnosti/${input.attributeId}`)
}
