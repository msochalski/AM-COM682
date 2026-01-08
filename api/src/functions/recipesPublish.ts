import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { callLogicAppWebhook } from "../lib/logicApp";
import { setPublishStatus } from "../lib/recipesRepo";

export const recipesPublish = createHttpHandler(async (request, _context, correlationId) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const updated = await setPublishStatus(id);
  if (!updated) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  await callLogicAppWebhook(process.env.LOGICAPP_WEBHOOK_URL, {
    id,
    isPublished: true,
    title: updated.title
  }, correlationId);

  return jsonResponse(200, {
    id,
    moderation_status: updated.moderation_status,
    is_published: updated.is_published
  });
});

app.http("recipesPublish", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/publish",
  handler: recipesPublish
});
