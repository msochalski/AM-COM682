import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { v4 as uuidv4 } from "uuid";
import { ApiError, isApiError } from "./errors";
import { createLogger } from "./logger";

const defaultCorsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export type HttpHandler = (
  request: HttpRequest,
  context: InvocationContext,
  correlationId: string
) => Promise<HttpResponseInit>;

export function createHttpHandler(handler: HttpHandler) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = getCorrelationId(request);
    const logger = createLogger(context, correlationId);
    const corsHeaders = getCorsHeaders();

    logger.info("Request received", {
      method: request.method,
      url: request.url
    });

    if (request.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          ...corsHeaders,
          "x-correlation-id": correlationId
        }
      };
    }

    try {
      const response = await handler(request, context, correlationId);
      return mergeHeaders(response, {
        ...corsHeaders,
        "x-correlation-id": correlationId
      });
    } catch (err) {
      logger.error("Request failed", {
        error: err instanceof Error ? err.message : String(err)
      });

      const errorResponse = toErrorResponse(err);
      return mergeHeaders(errorResponse, {
        ...corsHeaders,
        "x-correlation-id": correlationId
      });
    }
  };
}

export async function readJson<T>(request: HttpRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (err) {
    throw new ApiError(400, "Invalid JSON body", "invalid_json");
  }
}

export function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {})
    }
  };
}

function getCorrelationId(request: HttpRequest): string {
  const header = request.headers?.get("x-correlation-id") || request.headers?.get("x-request-id");
  return header ?? uuidv4();
}

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": defaultCorsOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-correlation-id",
    "Access-Control-Allow-Credentials": "true"
  };
}

function mergeHeaders(response: HttpResponseInit, headers: Record<string, string>): HttpResponseInit {
  return {
    ...response,
    headers: {
      ...(response.headers ?? {}),
      ...headers
    }
  };
}

function toErrorResponse(err: unknown): HttpResponseInit {
  if (isApiError(err)) {
    return jsonResponse(err.status, {
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null
      }
    });
  }

  return jsonResponse(500, {
    error: {
      code: "internal_error",
      message: "Unexpected server error",
      details: null
    }
  });
}
