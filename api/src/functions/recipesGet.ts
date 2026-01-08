import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { deleteRecipe, getRecipeById, updateRecipe } from "../lib/recipesRepo";
import { addComment, deleteCommentsForRecipe, deleteFeedItem, getComments } from "../lib/cosmosRepo";
import { getProcessedBlobNames } from "../lib/media";
import { getProcessedContainerClient, getRawContainerClient } from "../lib/storage";
import { asRecord, readIngredients, readPositiveInt, readString, readStringArray } from "../lib/validation";

export const recipesDetail = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const method = request.method.toUpperCase();

  if (method === "GET") {
    const recipe = await getRecipeById(id);
    if (!recipe) {
      throw new ApiError(404, "Recipe not found", "not_found");
    }

    return jsonResponse(200, recipe);
  }

  if (method === "PATCH" || method === "PUT") {
    const body = await readJson<unknown>(request);
    const data = asRecord(body);

    const payload = {
      title: readString(data.title, "title", { allowNull: true, minLength: 1 }),
      description: readString(data.description, "description", { allowNull: true }),
      instructions: readString(data.instructions, "instructions", { allowNull: true }),
      raw_image_blob_name: readString(data.raw_image_blob_name, "raw_image_blob_name", {
        allowNull: true,
        minLength: 1
      }),
      categories: readStringArray(data.categories, "categories", {
        allowNull: true,
        minLength: 1
      }),
      ingredients: readIngredients(data.ingredients, "ingredients")
    };

    const recipe = await updateRecipe(id, {
      title: payload.title,
      description: payload.description,
      instructions: payload.instructions,
      rawImageBlobName: payload.raw_image_blob_name,
      categories: payload.categories,
      ingredients: payload.ingredients
    });

    if (!recipe) {
      throw new ApiError(404, "Recipe not found", "not_found");
    }

    return jsonResponse(200, recipe);
  }

  if (method === "DELETE") {
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
  }

  throw new ApiError(405, "Method not allowed", "method_not_allowed");
});

app.http("recipesDetail", {
  methods: ["GET", "PATCH", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesDetail
});

// Comments - moved here to avoid routing issues
export const recipeComments = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const page = readPositiveInt(request.query.get("page"), "page", {
    defaultValue: 1,
    min: 1
  });
  const pageSize = readPositiveInt(request.query.get("pageSize"), "pageSize", {
    defaultValue: 20,
    min: 1,
    max: 100
  });

  const items = await getComments(id, page, pageSize);
  return jsonResponse(200, { items, page, pageSize });
});

app.http("recipeCommentsList", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/comments",
  handler: recipeComments
});

// POST comment
export const recipeCommentsCreate = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const body = await readJson<unknown>(request);
  const data = asRecord(body);
  const text = readString(data.text, "text", { required: true, minLength: 1 }) as string;
  const userId =
    (readString(data.user_id, "user_id", { allowNull: true, minLength: 1 }) as string | null | undefined) ??
    process.env.DEFAULT_USER_ID ??
    "00000000-0000-0000-0000-000000000001";

  const comment = await addComment(id, userId, text);
  return jsonResponse(201, comment);
});

app.http("recipeCommentsCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/comments",
  handler: recipeCommentsCreate
});
