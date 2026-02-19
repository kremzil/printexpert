export const OBS_EVENT = {
  HTTP_REQUEST_COMPLETED: "http.request.completed",
  SECURITY_ORIGIN_BLOCKED: "security.origin_blocked",
  SECURITY_CSRF_BLOCKED: "security.csrf_blocked",
  SECURITY_RATE_LIMIT_DENIED: "security.rate_limit_denied",
  AUTH_LOGIN_ATTEMPT: "auth.login_attempt",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  SERVER_UNHANDLED_ERROR: "server.unhandled_error",
  CLIENT_UNHANDLED_ERROR: "client.unhandled_error",
} as const;

export type ObservabilityEvent =
  (typeof OBS_EVENT)[keyof typeof OBS_EVENT];
