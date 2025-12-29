import { InvocationContext } from "@azure/functions";

export type Logger = {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
};

export function createLogger(context: InvocationContext, correlationId: string): Logger {
  const base = { correlationId };

  return {
    info(message, data) {
      context.log({ level: "info", message, ...base, ...(data ?? {}) });
    },
    warn(message, data) {
      context.log({ level: "warn", message, ...base, ...(data ?? {}) });
    },
    error(message, data) {
      context.log({ level: "error", message, ...base, ...(data ?? {}) });
    }
  };
}
