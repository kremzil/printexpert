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
    "image/svg+xml",
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
  const baseName = fileName.split(/[\\/]/).pop() || "file";
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : "file";
}

export function buildOrderAssetKey(orderId: string, assetId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `orders/${orderId}/${assetId}/${safeName}`;
}
