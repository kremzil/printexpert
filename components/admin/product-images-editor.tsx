"use client"

import { useOptimistic, useTransition, useState, useRef } from "react"
import Image from "next/image"
import { GripVertical, Star, Trash2, Plus, X } from "lucide-react"
import { ModeButton as Button } from "@/components/print/mode-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  addProductImage,
  deleteProductImage,
  setProductImagePrimary,
  reorderProductImages,
} from "@/app/admin/products/[id]/actions"

type ProductImage = {
  id: string
  url: string
  alt: string | null
  sortOrder: number
  isPrimary: boolean
}

type ProductImagesEditorProps = {
  productId: string
  images: ProductImage[]
}

export function ProductImagesEditor({ productId, images }: ProductImagesEditorProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticImages, setOptimisticImages] = useOptimistic(images)
  const [newImageUrl, setNewImageUrl] = useState("")
  const [isAddingImage, setIsAddingImage] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const sortedImages = [...optimisticImages].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1
    if (!a.isPrimary && b.isPrimary) return 1
    return a.sortOrder - b.sortOrder
  })

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return

    startTransition(async () => {
      setOptimisticImages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          url: newImageUrl.trim(),
          alt: null,
          sortOrder: prev.length,
          isPrimary: prev.length === 0,
        },
      ])
      await addProductImage({ productId, url: newImageUrl.trim() })
      setNewImageUrl("")
      setIsAddingImage(false)
    })
  }

  const handleDeleteImage = (imageId: string) => {
    startTransition(async () => {
      setOptimisticImages((prev) => prev.filter((img) => img.id !== imageId))
      await deleteProductImage({ productId, imageId })
    })
  }

  const handleSetPrimary = (imageId: string) => {
    startTransition(async () => {
      setOptimisticImages((prev) =>
        prev.map((img) => ({
          ...img,
          isPrimary: img.id === imageId,
        }))
      )
      await setProductImagePrimary({ productId, imageId })
    })
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const reordered = [...sortedImages]
    const [draggedItem] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOverItem.current, 0, draggedItem)

    const newOrder = reordered.map((img, index) => ({
      ...img,
      sortOrder: index,
    }))

    startTransition(async () => {
      setOptimisticImages(newOrder)
      await reorderProductImages({
        productId,
        imageIds: newOrder.map((img) => img.id),
      })
    })

    dragItem.current = null
    dragOverItem.current = null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Obrázky produktu</Label>
        {!isAddingImage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddingImage(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Pridať obrázok
          </Button>
        )}
      </div>

      {isAddingImage && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
          <Input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddImage()
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddImage}
            disabled={!newImageUrl.trim() || isPending}
          >
            Pridať
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAddingImage(false)
              setNewImageUrl("")
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {sortedImages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Žiadne obrázky. Pridajte prvý obrázok.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sortedImages.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "group relative aspect-square cursor-move overflow-hidden rounded-lg border bg-muted transition-all",
                image.isPrimary && "ring-2 ring-primary ring-offset-2",
                isPending && "opacity-50"
              )}
            >
              <Image
                src={image.url}
                alt={image.alt || "Obrázok produktu"}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />

              {/* Primary badge */}
              {image.isPrimary && (
                <div className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Hlavný
                </div>
              )}

              {/* Drag handle */}
              <div className="absolute left-2 top-2 hidden rounded bg-background/80 p-1 group-hover:block">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!image.isPrimary && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSetPrimary(image.id)}
                    disabled={isPending}
                    title="Nastaviť ako hlavný"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDeleteImage(image.id)}
                  disabled={isPending}
                  title="Odstrániť"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Kliknite na hviezdu pre nastavenie hlavného obrázka. Potiahnite obrázky pre zmenu poradia.
      </p>
    </div>
  )
}
