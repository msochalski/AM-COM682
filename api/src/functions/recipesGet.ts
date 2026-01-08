import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { getRecipeById, updateRecipe } from "../lib/recipesRepo";
import { getComments, addComment } from "../lib/cosmosRepo";
import { asRecord, readIngredients, readPositiveInt, readString, readStringArray } from "../lib/validation";

export const recipesGet = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const recipe = await getRecipeById(id);
  if (!recipe) {
    throw new ApiError(404, "Recipe not found", "not_found");
  }

  return jsonResponse(200, recipe);
});

export const recipesUpdate = createHttpHandler(async (request) => {
  const id = request.params.id;
  if (!id) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

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
});

app.http("recipeGet", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesGet
});

app.http("recipeUpdate", {
  methods: ["PATCH", "PUT"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesUpdate
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
