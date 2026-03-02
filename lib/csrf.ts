export const CSRF_COOKIE_NAME = "pe_csrf";
export const CSRF_EXCLUDED_API_PREFIXES = [
  "/api/auth",
  "/api/stripe/webhook",
  "/api/client-error",
] as const;

const SAFE_HTTP_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export function isUnsafeHttpMethod(method: string): boolean {
  return !SAFE_HTTP_METHODS.includes(method.toUpperCase() as (typeof SAFE_HTTP_METHODS)[number]);
}

export function isCsrfExcludedApiPath(pathname: string): boolean {
  return CSRF_EXCLUDED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (key !== name) continue;
    return rest.join("=").trim() || null;
  }
  return null;
}

export function getCsrfTokenFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  return getCookieValue(document.cookie ?? "", CSRF_COOKIE_NAME);
}

export function getCsrfHeader(): Record<string, string> {
  const token = getCsrfTokenFromDocument();
  return token ? { "X-CSRF-Token": token } : {};
}
