import { app, HttpRequest, InvocationContext, HttpResponseInit } from "@azure/functions";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { listRecipes, createRecipe } from "../lib/recipesRepo";
import { sendQueueMessage } from "../lib/storage";
import {
  asRecord,
  readBoolean,
  readEmail,
  readIngredients,
  readPositiveInt,
  readString,
  readStringArray,
  readUuid
} from "../lib/validation";

// GET /api/v1/recipes - List recipes
export const recipesList = createHttpHandler(async (request) => {
  const page = readPositiveInt(request.query.get("page"), "page", {
    defaultValue: 1,
    min: 1
  });
  const pageSize = readPositiveInt(request.query.get("pageSize"), "pageSize", {
    defaultValue: 20,
    min: 1,
    max: 100
  });
  const q = request.query.get("q");
  const category = request.query.get("category");
  const isPublished = readBoolean(request.query.get("isPublished"), "isPublished");

  const result = await listRecipes({
    page,
    pageSize,
    q: q ? q : null,
    isPublished: isPublished ?? null,
    category: category ? category : null
  });

  return jsonResponse(200, result);
});

// TEMPORARILY DISABLED to test recipesGet
// app.http("recipesList", {
//   methods: ["GET"],
//   authLevel: "anonymous",
//   route: "api/v1/recipes",
//   handler: recipesList
// });

// POST /api/v1/recipes - Create recipe
export const recipesCreate = createHttpHandler(async (request, context) => {
  const body = await readJson<unknown>(request);
  const data = asRecord(body);

  const payload = {
    title: readString(data.title, "title", { required: true, minLength: 1 }) as string,
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
    ingredients: readIngredients(data.ingredients, "ingredients"),
    user_id: readUuid(data.user_id, "user_id", { allowNull: true }),
    user_name: readString(data.user_name, "user_name", { allowNull: true }),
    user_email: readEmail(data.user_email, "user_email", { allowNull: true })
  };

  const recipe = await createRecipe({
    title: payload.title,
    description: payload.description ?? null,
    instructions: payload.instructions ?? null,
    rawImageBlobName: payload.raw_image_blob_name ?? null,
    categories: payload.categories ?? null,
    ingredients: payload.ingredients ?? null,
    userId: payload.user_id ?? null,
    userName: payload.user_name ?? null,
    userEmail: payload.user_email ?? null
  });

  // Queue message for media processing if image was provided
  if (payload.raw_image_blob_name) {
    await sendQueueMessage("media-process", {
      recipeId: recipe.id,
      blobName: payload.raw_image_blob_name
    });
  }

  return jsonResponse(201, recipe);
});

app.http("recipesCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/v1/recipes",
  handler: recipesCreate
});
