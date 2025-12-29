import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { getRecipeById } from "../lib/recipesRepo";

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

app.http("recipesGet", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}",
  handler: recipesGet
});