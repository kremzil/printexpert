import path from "node:path";

const DEFAULT_UPLOAD_MAX_BYTES = 100_000_000;

const resolvedMaxBytes = Number.parseInt(process.env.UPLOAD_MAX_BYTES ?? "", 10);

export const uploadConfig = {
  maxBytes:
    Number.isFinite(resolvedMaxBytes) && resolvedMaxBytes > 0
      ? resolvedMaxBytes
      : DEFAULT_UPLOAD_MAX_BYTES,
  allowedMimeTypes: [
    "application/pdf",
    "application/postscript",
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
  ],
  deniedExtensions: [
    "exe",
    "js",
    "sh",
    "bat",
    "cmd",
    "php",
    "py",
    "pl",
    "rb",
    "jar",
    "msi",
    "com",
    "dll",
  ],
};

export function normalizeMimeType(value: string | null | undefined): string {
  if (!value) return "";
  return value.split(";")[0].trim().toLowerCase();
}

export function isMimeAllowed(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  return uploadConfig.allowedMimeTypes.includes(normalized);
}

export function isExtensionDenied(fileName: string): boolean {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  if (!extension) return false;
  return uploadConfig.deniedExtensions.includes(extension);
}

export function sanitizeFileName(fileName: string): string {
  const MAX_LENGTH = 255;
  const baseName = fileName.split(/[\\/]/).pop() || "file";
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();

  const trimmed =
    normalized.length > MAX_LENGTH
      ? normalized.slice(0, MAX_LENGTH).replace(/^[-.]+|[-.]+$/g, "")
      : normalized;

  return trimmed.length > 0 ? trimmed : "file";
}

export function buildOrderAssetKey(orderId: string, assetId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `orders/${orderId}/${assetId}/${safeName}`;
}

const BYTE_SIGNATURES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  gif89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
  postscript: [0x25, 0x21, 0x50, 0x53],
  tiffLe: [0x49, 0x49, 0x2a, 0x00],
  tiffBe: [0x4d, 0x4d, 0x00, 0x2a],
  webm: [0x1a, 0x45, 0xdf, 0xa3],
  riff: [0x52, 0x49, 0x46, 0x46],
  webp: [0x57, 0x45, 0x42, 0x50],
  ftyp: [0x66, 0x74, 0x79, 0x70],
};

const hasPrefix = (buffer: Buffer, signature: number[]) =>
  signature.every((byte, index) => buffer[index] === byte);

export function detectMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  if (buffer.length >= BYTE_SIGNATURES.jpeg.length && hasPrefix(buffer, BYTE_SIGNATURES.jpeg)) {
    return "image/jpeg";
  }

  if (buffer.length >= BYTE_SIGNATURES.png.length && hasPrefix(buffer, BYTE_SIGNATURES.png)) {
    return "image/png";
  }

  if (
    buffer.length >= BYTE_SIGNATURES.gif87a.length &&
    (hasPrefix(buffer, BYTE_SIGNATURES.gif87a) || hasPrefix(buffer, BYTE_SIGNATURES.gif89a))
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    hasPrefix(buffer, BYTE_SIGNATURES.riff) &&
    buffer.slice(8, 12).equals(Buffer.from(BYTE_SIGNATURES.webp))
  ) {
    return "image/webp";
  }

  if (buffer.length >= BYTE_SIGNATURES.pdf.length && hasPrefix(buffer, BYTE_SIGNATURES.pdf)) {
    return "application/pdf";
  }

  if (
    buffer.length >= BYTE_SIGNATURES.postscript.length &&
    hasPrefix(buffer, BYTE_SIGNATURES.postscript)
  ) {
    return "application/postscript";
  }

  if (
    buffer.length >= BYTE_SIGNATURES.tiffLe.length &&
    (hasPrefix(buffer, BYTE_SIGNATURES.tiffLe) || hasPrefix(buffer, BYTE_SIGNATURES.tiffBe))
  ) {
    return "image/tiff";
  }

  if (buffer.length >= BYTE_SIGNATURES.webm.length && hasPrefix(buffer, BYTE_SIGNATURES.webm)) {
    return "video/webm";
  }

  if (buffer.length >= 12 && buffer.slice(4, 8).equals(Buffer.from(BYTE_SIGNATURES.ftyp))) {
    return "video/mp4";
  }

  return null;
}

const COMPATIBLE_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [
    "application/pdf",
    "application/illustrator",
    "application/vnd.adobe.illustrator",
  ],
  "application/postscript": [
    "application/postscript",
    "application/illustrator",
    "application/vnd.adobe.illustrator",
  ],
};

export function isMimeCompatible(detected: string, expected: string): boolean {
  if (detected === expected) return true;
  const compat = COMPATIBLE_MIME_TYPES[detected];
  return compat ? compat.includes(expected) : false;
}

export const MAGIC_BYTES_MAX = 4096;
