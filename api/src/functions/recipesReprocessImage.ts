import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { getRecipeById } from "../lib/recipesRepo";
import { sendQueueMessage } from "../lib/storage";

export const recipesReprocessImage = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const recipe = await getRecipeById(id);
  if (!recipe) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  const blobName = (recipe.raw_image_blob_name as string | null) ?? null;
  if (!blobName) {
    throw new ApiError(400, "Recipe has no raw image to process", "no_raw_image");
  }

  await sendQueueMessage("media-process", { recipeId: id, blobName });

  return jsonResponse(202, { enqueued: true, recipeId: id, blobName });
});

app.http("recipesReprocessImage", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipe/{id}/reprocess-image",
  handler: recipesReprocessImage
});
