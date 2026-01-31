"use server"

import { revalidatePath, updateTag } from "next/cache"

import { resolveAudienceContext } from "@/lib/audience-context"
import { getPrisma } from "@/lib/prisma"

type DeleteAttributeInput = {
  attributeId: number
  attributeName: string
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

export async function createAttribute(formData: FormData) {
  const prisma = getPrisma()
  const label = String(formData.get("label") ?? "").trim()
  const rawName = String(formData.get("name") ?? "").trim()
  const type = String(formData.get("type") ?? "").trim()

  if (!label && !rawName) {
    return
  }

  const name = normalizeSlug(rawName || label)
  const attributeLabel = label || rawName

  const latest = await prisma.wpAttributeTaxonomy.findFirst({
    orderBy: { attributeId: "desc" },
    select: { attributeId: true },
  })
  const nextId = (latest?.attributeId ?? 0) + 1

  await prisma.wpAttributeTaxonomy.create({
    data: {
      attributeId: nextId,
      attributeName: name,
      attributeLabel,
      attributeType: type || null,
    },
  })

  const audienceTag = await getAudienceTag()
  updateTag("attributes")
  updateTag(audienceTag)
  revalidatePath("/admin/vlastnosti")
}

export async function deleteAttribute(input: DeleteAttributeInput) {
  const prisma = getPrisma()
  const taxonomy = `pa_${input.attributeName}`

  const termTaxonomies = await prisma.wpTermTaxonomy.findMany({
    where: { taxonomy },
  })
  const termTaxonomyIds = termTaxonomies.map((row) => row.termTaxonomyId)
  const termIds = termTaxonomies.map((row) => row.termId)

  await prisma.$transaction(async (tx) => {
    if (termTaxonomyIds.length > 0) {
      await tx.wpTermRelationship.deleteMany({
        where: { termTaxonomyId: { in: termTaxonomyIds } },
      })
      await tx.wpTermTaxonomy.deleteMany({
        where: { termTaxonomyId: { in: termTaxonomyIds } },
      })
    }

    if (termIds.length > 0) {
      const remaining = await tx.wpTermTaxonomy.findMany({
        where: {
          termId: { in: termIds },
          taxonomy: { not: taxonomy },
        },
        select: { termId: true },
      })
      const remainingIds = new Set(remaining.map((row) => row.termId))
      const deletableTermIds = termIds.filter((id) => !remainingIds.has(id))

      if (deletableTermIds.length > 0) {
        await tx.wpTermMeta.deleteMany({
          where: { termId: { in: deletableTermIds } },
        })
        await tx.wpTerm.deleteMany({
          where: { termId: { in: deletableTermIds } },
        })
      }
    }

    await tx.wpAttributeTaxonomy.delete({
      where: { attributeId: input.attributeId },
    })
  })

  const audienceTag = await getAudienceTag()
  updateTag("attributes")
  updateTag(audienceTag)
  revalidatePath("/admin/vlastnosti")
}
