import { app } from "@azure/functions";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { listRecipes } from "../lib/recipesRepo";
import { readBoolean, readPositiveInt } from "../lib/validation";

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

app.http("recipesList", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes",
  handler: recipesList
});
