"use client"

import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProductTitleEditorProps = {
  initialName: string
  initialSlug: string
}

export function ProductTitleEditor({
  initialName,
  initialSlug,
}: ProductTitleEditorProps) {
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingSlug, setIsEditingSlug] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-2xl font-semibold">{name}</div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setIsEditingName((prev) => !prev)}
        >
          {isEditingName ? "Hotovo" : "Upraviť názov"}
        </Button>
      </div>
      {isEditingName ? (
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Názov produktu"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Slug:</span>
        <Link
          href={`/product/${slug}`}
          className="text-primary underline underline-offset-4"
        >
          /product/{slug}
        </Link>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setIsEditingSlug((prev) => !prev)}
        >
          {isEditingSlug ? "Hotovo" : "Upraviť slug"}
        </Button>
      </div>
      {isEditingSlug ? (
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="slug"
        />
      ) : null}

      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="slug" value={slug} />
    </div>
  )
}
