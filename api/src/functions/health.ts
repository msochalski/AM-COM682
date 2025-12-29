import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { checkHealth } from "../lib/health";
import { createHttpHandler, jsonResponse } from "../lib/http";

export const health = createHttpHandler(async () => {
  try {
    await checkHealth();
    return jsonResponse(200, { ok: true });
  } catch (err) {
    throw new ApiError(503, "Health check failed", "health_check_failed");
  }
});

app.http("health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/health",
  handler: health
});