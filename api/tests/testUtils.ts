import { HttpRequest, InvocationContext } from "@azure/functions";
import { vi } from "vitest";

export function makeRequest(options?: {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): HttpRequest {
  const headers = new Headers(options?.headers ?? {});
  const query = new URLSearchParams(options?.query ?? {});

  return {
    method: options?.method ?? "GET",
    url: "http://localhost",
    headers,
    query,
    params: options?.params ?? {},
    json: async () => options?.body
  } as unknown as HttpRequest;
}

export function makeContext(): InvocationContext {
  return {
    invocationId: "test",
    functionName: "test",
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    extraOutputs: {
      set: vi.fn(),
      get: vi.fn()
    }
  } as unknown as InvocationContext;
}
