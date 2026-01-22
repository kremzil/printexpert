import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])
const allowedVideoTypes = new Set(["video/mp4", "video/webm"])

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-z0-9._-]/gi, "_").toLowerCase()

const resolveUploadPath = (hash: string, ext: string) => {
  const fileName = `${hash}${ext}`
  return {
    fileName,
    absolutePath: path.join(process.cwd(), "public", "uploads", fileName),
    publicUrl: `/uploads/${fileName}`,
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")
  const kind = String(formData.get("kind") ?? "").trim()

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chýba súbor." }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Súbor je príliš veľký." }, { status: 400 })
  }

  const contentType = file.type
  const isImage = allowedImageTypes.has(contentType)
  const isVideo = allowedVideoTypes.has(contentType)

  if ((kind === "image" && !isImage) || (kind === "video" && !isVideo)) {
    return NextResponse.json({ error: "Nepodporovaný typ súboru." }, { status: 400 })
  }

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Nepodporovaný typ súboru." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const hash = createHash("sha256").update(buffer).digest("hex")
  const ext = path.extname(sanitizeFileName(file.name)) || ""

  const { absolutePath, publicUrl } = resolveUploadPath(hash, ext)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)

  return NextResponse.json({ url: publicUrl })
}
