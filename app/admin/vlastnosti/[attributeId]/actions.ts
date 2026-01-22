"use server"

import { revalidatePath, updateTag } from "next/cache"

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

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

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

  updateTag("attributes")
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

  updateTag("attributes")
  revalidatePath(`/admin/vlastnosti/${input.attributeId}`)
}
