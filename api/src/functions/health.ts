import { app, InvocationContext } from "@azure/functions";
import { checkHealth, HealthLogInfo } from "../lib/health";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { createLogger } from "../lib/logger";

export const health = createHttpHandler(async (request, context, correlationId) => {
  const logger = createLogger(context, correlationId);
  
  const { response, failedLogs } = await checkHealth();
  
  // Log structured info for each failed dependency (no secrets)
  for (const log of failedLogs) {
    logger.error("Health check failed for dependency", {
      dependency: log.dependency,
      errorName: log.errorName,
      errorMessage: log.errorMessage,
      errorStack: log.errorStack
    });
  }
  
  const status = response.ok ? 200 : 503;
  return jsonResponse(status, response);
});

app.http("health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/health",
  handler: health
});