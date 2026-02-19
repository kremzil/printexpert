import { logger } from "@/lib/observability/logger";
import { OBS_EVENT } from "@/lib/observability/events";
import {
  getClientIpHash,
  getRequestIdOrCreate,
  setRequestIdHeader,
} from "@/lib/request-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRouteHandler = (...args: any[]) => Promise<Response> | Response;

export function withObservedRoute<T extends AnyRouteHandler>(
  routeId: string,
  handler: T
): T {
  const observedRoute = (async (...args: Parameters<T>) => {
    const request = args[0] as Request;
    const startedAt = Date.now();
    const requestId = getRequestIdOrCreate(request);
    const ipHash = getClientIpHash(request);
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      const response = await handler(...args);
      setRequestIdHeader(response, requestId);

      const durationMs = Date.now() - startedAt;
      const status = response.status;
      const payload = {
        event: OBS_EVENT.HTTP_REQUEST_COMPLETED,
        requestId,
        routeId,
        method,
        path: pathname,
        status,
        durationMs,
        ipHash,
      };

      if (status >= 500) {
        logger.error(payload);
      } else if (status >= 400) {
        logger.warn(payload);
      } else {
        logger.info(payload);
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const err = error instanceof Error ? error : new Error("Unknown route handler error");
      logger.error({
        event: OBS_EVENT.HTTP_REQUEST_COMPLETED,
        requestId,
        routeId,
        method,
        path: pathname,
        status: 500,
        durationMs,
        ipHash,
        errorName: err.name,
        errorMessage: err.message,
      });
      throw error;
    }
  }) as T;

  return observedRoute;
}
