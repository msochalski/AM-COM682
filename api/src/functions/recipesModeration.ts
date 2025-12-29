import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { setModerationStatus } from "../lib/recipesRepo";

export const recipesApprove = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const updated = await setModerationStatus(id, "approved", true);
  if (!updated) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  return jsonResponse(200, updated);
});

export const recipesBlock = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const updated = await setModerationStatus(id, "blocked", false);
  if (!updated) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  return jsonResponse(200, updated);
});

app.http("recipesApprove", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/approve",
  handler: recipesApprove
});

app.http("recipesBlock", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/block",
  handler: recipesBlock
});