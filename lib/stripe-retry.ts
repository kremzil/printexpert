type StripeRetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
};

type StripeErrorLike = {
  statusCode?: number;
  code?: string;
  type?: string;
  headers?: Record<string, string | undefined>;
  raw?: {
    statusCode?: number;
    headers?: Record<string, string | undefined>;
  };
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 300;

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRetryAfterMs = (error: StripeErrorLike): number | null => {
  const retryAfterHeader =
    error.headers?.["retry-after"] ?? error.raw?.headers?.["retry-after"];
  if (!retryAfterHeader) {
    return null;
  }

  const retryAfterSeconds = Number.parseFloat(retryAfterHeader);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return null;
  }

  return Math.round(retryAfterSeconds * 1000);
};

const shouldRetryStripeError = (error: unknown): error is StripeErrorLike => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as StripeErrorLike;
  const statusCode = stripeError.statusCode ?? stripeError.raw?.statusCode;

  if (statusCode === 429) {
    return true;
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return true;
  }

  if (stripeError.code === "rate_limit") {
    return true;
  }

  return (
    stripeError.type === "StripeConnectionError" ||
    stripeError.type === "StripeAPIError"
  );
};

export const withStripeRetry = async <T>(
  operation: () => Promise<T>,
  options: StripeRetryOptions = {}
): Promise<T> => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!shouldRetryStripeError(error) || attempt >= maxRetries) {
        throw error;
      }

      const exponentialDelayMs = initialDelayMs * 2 ** attempt;
      const retryAfterMs = parseRetryAfterMs(error);
      const delayMs = retryAfterMs
        ? Math.max(exponentialDelayMs, retryAfterMs)
        : exponentialDelayMs;

      await sleep(delayMs);
    }
  }
};

export const buildStripeIdempotencyKey = (
  ...parts: Array<string | number | null | undefined>
): string => {
  const key = parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part))
    .join(":");

  return (key || "stripe-operation").slice(0, 255);
};
