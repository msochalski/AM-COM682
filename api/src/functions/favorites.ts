import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { addFavorite, removeFavorite } from "../lib/recipesRepo";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { asRecord, readString } from "../lib/validation";

export const favoriteAdd = createHttpHandler(async (request) => {
  const recipeId = request.params.id;
  if (!recipeId) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const body = await readJson<unknown>(request);
  const data = asRecord(body ?? {});
  const userId =
    (readString(data.user_id, "user_id", { allowNull: true, minLength: 1 }) as string | null | undefined) ??
    process.env.DEFAULT_USER_ID ??
    "00000000-0000-0000-0000-000000000001";
  const userName = readString(data.user_name, "user_name", { allowNull: true, minLength: 1 });

  await addFavorite(recipeId, userId, userName ?? null);

  return jsonResponse(201, { recipeId, userId });
});

export const favoriteRemove = createHttpHandler(async (request) => {
  const recipeId = request.params.id;
  if (!recipeId) {
    throw new ApiError(400, "Recipe id is required", "invalid_request");
  }

  const userId =
    request.query.get("userId") ??
    process.env.DEFAULT_USER_ID ??
    "00000000-0000-0000-0000-000000000001";
  await removeFavorite(recipeId, userId);

  return jsonResponse(200, { recipeId, userId, deleted: true });
});

app.http("favoriteAdd", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/favorite",
  handler: favoriteAdd
});

app.http("favoriteRemove", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/favorite",
  handler: favoriteRemove
});
