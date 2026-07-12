import pino, { type Logger } from "pino";

const REDACTED_PATHS = [
  "apiKey",
  "token",
  "password",
  "secret",
  "authorization",
  "headers.authorization",
  "req.headers.authorization"
];

export function createLogger(level = "info"): Logger {
  return pino(
    {
      level,
      redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
      base: { service: "ai-memory-system" }
    },
    pino.destination(2)
  );
}
