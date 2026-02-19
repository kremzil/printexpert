import type { Instrumentation } from "next";

import { OBS_EVENT } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { hashIp, REQUEST_ID_HEADER } from "@/lib/request-utils";

function normalizeHeaderValue(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function getIpHashFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string {
  const forwarded = normalizeHeaderValue(headers["x-forwarded-for"]);
  const real = normalizeHeaderValue(headers["x-real-ip"]);
  const ip = (forwarded.split(",")[0]?.trim() || real || "unknown").trim();
  return hashIp(ip);
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const err = error instanceof Error ? error : new Error("Unknown request error");
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest?: string }).digest
      : undefined;
  const requestId = normalizeHeaderValue(request.headers[REQUEST_ID_HEADER]);
  const ipHash = getIpHashFromHeaders(request.headers);

  logger.error({
    event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
    requestId: requestId || undefined,
    ipHash,
    path: request.path,
    method: request.method,
    digest,
    errorName: err.name,
    errorMessage: err.message,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
