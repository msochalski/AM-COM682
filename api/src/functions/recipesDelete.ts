import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { deleteRecipe } from "../lib/recipesRepo";
import { deleteCommentsForRecipe, deleteFeedItem } from "../lib/cosmosRepo";
import { getProcessedBlobNames } from "../lib/media";
import { getProcessedContainerClient, getRawContainerClient } from "../lib/storage";

export const recipesDelete = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const recipe = await deleteRecipe(id);
  if (!recipe) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  const rawBlobName = (recipe.raw_image_blob_name as string | null) ?? null;
  if (rawBlobName) {
    const rawContainer = await getRawContainerClient();
    await rawContainer.deleteBlob(rawBlobName).catch(() => undefined);
  }

  const processedContainer = await getProcessedContainerClient();
  const { thumbName, imageName } = getProcessedBlobNames(id);
  await processedContainer.deleteBlob(thumbName).catch(() => undefined);
  await processedContainer.deleteBlob(imageName).catch(() => undefined);

  await deleteFeedItem(id).catch(() => undefined);
  await deleteCommentsForRecipe(id).catch(() => undefined);

  return jsonResponse(200, { deleted: true, id });
});

app.http("recipesDelete", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesDelete
});