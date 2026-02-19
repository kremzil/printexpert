import pino from "pino";

const logLevel = process.env.LOG_LEVEL ?? "info";
const shouldPrettyPrint =
  process.env.LOG_PRETTY !== undefined
    ? process.env.LOG_PRETTY === "true"
    : process.env.NODE_ENV !== "production";

const serviceName = process.env.OBS_SERVICE_NAME ?? "shop-web";
const environment = process.env.OBS_ENV ?? process.env.NODE_ENV ?? "development";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "headers.authorization",
  "headers.cookie",
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordHash",
  "token",
  "refresh_token",
  "access_token",
  "id_token",
  "secret",
  "smtpPass",
  "s3SecretAccessKey",
];

export const logger = pino({
  level: logLevel,
  base: {
    service: serviceName,
    env: environment,
  },
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(shouldPrettyPrint
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});
