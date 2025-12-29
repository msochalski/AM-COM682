import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { updateRecipe } from "../lib/recipesRepo";
import { asRecord, readIngredients, readString, readStringArray } from "../lib/validation";

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

app.http("recipesUpdate", {
  methods: ["PATCH", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesUpdate
});
