export const REQUEST_ID_HEADER = "x-request-id";

const IP_HASH_SALT =
  process.env.LOG_IP_HASH_SALT ??
  process.env.AUTH_SECRET ??
  "printexpert-observability-salt";

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function fnv1a(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function hashValue(value: string): string {
  const normalized = `${IP_HASH_SALT}:${value}`;
  // Multi-pass FNV-1a is runtime-safe (Node + Edge) and deterministic.
  return [
    fnv1a(normalized, 0x811c9dc5),
    fnv1a(normalized, 0x01000193),
    fnv1a(normalized, 0x9e3779b1),
    fnv1a(normalized, 0x85ebca6b),
  ].join("");
}

export function hashIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  return hashValue(ip);
}

function randomUuidFallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getClientIpHash(request: Request): string {
  return hashIp(getClientIp(request));
}

export function getRequestIdOrCreate(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (incoming) return incoming;
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return randomUuidFallback();
}

export function setRequestIdHeader(response: Response, requestId: string): Response {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
