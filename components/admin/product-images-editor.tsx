"use client"

import {
  useOptimistic,
  useTransition,
  useState,
  useRef,
  type ChangeEvent,
} from "react"
import Image from "next/image"
import { GripVertical, Star, Trash2, Plus, X, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { resolveProductImageUrl } from "@/lib/image-url"
import { getCsrfHeader } from "@/lib/csrf"
import { toast } from "sonner"
import {
  addProductImage,
  deleteProductImage,
  setProductImagePrimary,
  reorderProductImages,
} from "@/app/(admin)/admin/products/[id]/actions"

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

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const allowedClientTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

export function ProductImagesEditor({ productId, images }: ProductImagesEditorProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticImages, setOptimisticImages] = useOptimistic(images)
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isBusy = isPending || isUploading

  const sortedImages = [...optimisticImages].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1
    if (!a.isPrimary && b.isPrimary) return 1
    return a.sortOrder - b.sortOrder
  })

  const uploadSingleFile = async (file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    formData.set("productId", productId)

    const response = await fetch("/api/admin/products/upload-image", {
      method: "POST",
      headers: getCsrfHeader(),
      body: formData,
    })

    const payload = (await response.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null

    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error || "Nepodarilo sa nahrať obrázok.")
    }

    return String(payload.url)
  }

  const validateFiles = (files: File[]) => {
    if (!files.length) {
      return { ok: false, reason: "Nevybrali ste žiadny súbor." }
    }

    const invalidType = files.find((file) => !allowedClientTypes.has(file.type))
    if (invalidType) {
      return {
        ok: false,
        reason: `Nepodporovaný typ súboru: ${invalidType.name}`,
      }
    }

    const oversized = files.find((file) => file.size > MAX_UPLOAD_SIZE)
    if (oversized) {
      return {
        ok: false,
        reason: `Súbor je príliš veľký (max 10 MB): ${oversized.name}`,
      }
    }

    return { ok: true, reason: "" }
  }

  const handleUploadFiles = async (input: FileList | File[]) => {
    const files = Array.from(input)
    const validation = validateFiles(files)
    if (!validation.ok) {
      toast.error(validation.reason)
      return
    }

    setIsUploading(true)
    try {
      let addedCount = 0
      for (const file of files) {
        const uploadedUrl = await uploadSingleFile(file)
        setOptimisticImages((prev) => [
          ...prev,
          {
            id: `temp-upload-${Date.now()}-${prev.length}`,
            url: uploadedUrl,
            alt: null,
            sortOrder: prev.length,
            isPrimary: prev.length === 0,
          },
        ])
        await addProductImage({ productId, url: uploadedUrl })
        addedCount += 1
      }

      setIsAddingImage(false)
      toast.success(
        addedCount > 1
          ? `Nahrané obrázky: ${addedCount}`
          : "Obrázok bol nahraný."
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nahrávanie zlyhalo.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await handleUploadFiles(files)
    }
    event.target.value = ""
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
            Nahrať obrázky
          </Button>
        )}
      </div>

      {isAddingImage && (
        <div className="space-y-3 rounded-lg border bg-muted/50 p-4 transition-all animate-in fade-in-0 zoom-in-95">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragActive(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              const related = event.relatedTarget as Node | null
              if (related && event.currentTarget.contains(related)) return
              setIsDragActive(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragActive(false)
              const files = event.dataTransfer.files
              if (files && files.length > 0) {
                void handleUploadFiles(files)
              }
            }}
            className={cn(
              "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-background px-4 text-center transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/40",
              isBusy && "pointer-events-none opacity-70"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Pretiahnite obrázky sem alebo kliknite pre výber
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP, GIF, AVIF · max 10 MB na súbor
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Obrázky sa nahrajú do S3 a automaticky priradia k produktu.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setIsAddingImage(false)}
              disabled={isBusy}
            >
              <X className="mr-2 h-4 w-4" />
              Zavrieť
            </Button>
          </div>
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
          {sortedImages.map((image, index) => {
            const imageUrl = resolveProductImageUrl(image.url)
            return (
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
                  isBusy && "opacity-50"
                )}
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={image.alt || "Obrázok produktu"}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Bez obrázku
                  </div>
                )}

                {image.isPrimary && (
                  <div className="absolute left-2 top-2 z-10 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                    Hlavný
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />

                <div className="absolute right-2 top-2 z-10 hidden rounded-md bg-white/90 p-1.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                  <GripVertical className="h-3.5 w-3.5 text-foreground/70" />
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {!image.isPrimary && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-white text-muted-foreground hover:text-primary shadow-sm"
                      onClick={() => handleSetPrimary(image.id)}
                      disabled={isBusy}
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
                    disabled={isBusy}
                    title="Odstrániť"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}

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
