"use client"

import { useOptimistic, useTransition, useState, useRef } from "react"
import Image from "next/image"
import { GripVertical, Star, Trash2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <Label className="text-base font-medium">Galéria</Label>
          <p className="text-sm text-muted-foreground">
            Spravujte obrázky produktu. Prvý obrázok bude použitý ako hlavný.
          </p>
        </div>
        {!isAddingImage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setIsAddingImage(true)}
          >
            <Plus className="h-4 w-4" />
            Pridať obrázok
          </Button>
        )}
      </div>

      {isAddingImage && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-4 transition-all animate-in fade-in-0 zoom-in-95">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="image-url" className="sr-only">
              URL obrázka
            </Label>
            <Input
              id="image-url"
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
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Zadajte priamy odkaz na obrázok (zahrňte https://).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddImage}
            disabled={!newImageUrl.trim() || isPending}
            className="h-9"
          >
            Pridať
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            onClick={() => {
              setIsAddingImage(false)
              setNewImageUrl("")
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Zrušiť</span>
          </Button>
        </div>
      )}

      {sortedImages.length === 0 && !isAddingImage ? (
        <div 
          onClick={() => setIsAddingImage(true)}
          className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center transition-colors hover:bg-muted/50"
        >
          <div className="rounded-full bg-muted p-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Nahrať prvý obrázok
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedImages.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "group relative aspect-square cursor-move overflow-hidden rounded-lg border bg-background shadow-sm transition-all hover:shadow-md",
                image.isPrimary && "ring-2 ring-primary ring-offset-2",
                isPending && "opacity-50"
              )}
            >
              <Image
                src={image.url}
                alt={image.alt || "Obrázok produktu"}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              />

              {/* Primary badge */}
              {image.isPrimary && (
                <div className="absolute left-2 top-2 z-10 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  Hlavný
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />

              {/* Drag handle */}
              <div className="absolute right-2 top-2 z-10 hidden rounded-md bg-white/90 p-1.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                <GripVertical className="h-3.5 w-3.5 text-foreground/70" />
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {!image.isPrimary && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-white/90 hover:bg-white text-muted-foreground hover:text-primary shadow-sm"
                    onClick={() => handleSetPrimary(image.id)}
                    disabled={isPending}
                    title="Nastaviť ako hlavný"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/90 hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                  onClick={() => handleDeleteImage(image.id)}
                  disabled={isPending}
                  title="Odstrániť"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {/* Add Helper Card in Grid */}
          {!isAddingImage && sortedImages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAddingImage(true)}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 hover:bg-muted/30 transition-colors"
            >
              <Plus className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-xs font-medium text-muted-foreground">Pridať ďalší</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
