import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import path from "node:path"
import sharp from "sharp"
import { PutObjectCommand } from "@aws-sdk/client-s3"

import { auth } from "@/auth"
import { getS3Client, getS3Config } from "@/lib/s3"
import { detectMimeTypeFromBuffer, normalizeMimeType } from "@/lib/uploads/config"
import { withObservedRoute } from "@/lib/observability/with-observed-route"

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])
const DEFAULT_PRODUCTS_CDN_BASE_URL = "https://cdn.printexpert.sk"

const buildProductsPublicUrl = (objectKey: string) => {
  const configuredBase = (
    process.env.PRODUCTS_CDN_BASE_URL ||
    process.env.NEXT_PUBLIC_PRODUCTS_CDN_BASE_URL ||
    DEFAULT_PRODUCTS_CDN_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "")

  return `${configuredBase}/${objectKey}`
}

const POSTHandler = async (request: Request) => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const productIdRaw = String(formData.get("productId") ?? "").trim()
  const productId = productIdRaw.replace(/[^a-zA-Z0-9-_]/g, "")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chýba súbor." }, { status: 400 })
  }

  if (!productId) {
    return NextResponse.json({ error: "Chýba ID produktu." }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Súbor je príliš veľký." }, { status: 400 })
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = normalizeMimeType(detectMimeTypeFromBuffer(inputBuffer))
  if (!detectedMime || !allowedImageTypes.has(detectedMime)) {
    return NextResponse.json(
      { error: "Nepodporovaný typ obrázka." },
      { status: 400 }
    )
  }

  const transformed = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  const hash = createHash("sha256").update(transformed).digest("hex").slice(0, 32)
  const objectKey = path.posix.join("products", productId, `${hash}.webp`)

  const { bucket } = getS3Config()
  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: transformed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return NextResponse.json({ url: buildProductsPublicUrl(objectKey) })
}

export const POST = withObservedRoute(
  "POST /api/admin/products/upload-image",
  POSTHandler
)
