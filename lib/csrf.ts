export const CSRF_COOKIE_NAME = "pe_csrf";

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

