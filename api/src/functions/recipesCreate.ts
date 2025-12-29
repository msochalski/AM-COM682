import * as azfunc from "@azure/functions";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { createRecipe } from "../lib/recipesRepo";
import {
  asRecord,
  readEmail,
  readIngredients,
  readString,
  readStringArray,
  readUuid
} from "../lib/validation";

const app = azfunc.app;
const output = (azfunc as any).output as {
  storageQueue: (options: { queueName: string; connection: string; name: string }) => any;
};

const mediaQueueOutput = output.storageQueue({
  queueName: process.env.MEDIA_QUEUE ?? "media-process",
  connection: "AzureWebJobsStorage",
  name: "mediaQueue"
});

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

  if (payload.raw_image_blob_name) {
    (context as any).extraOutputs?.set?.(mediaQueueOutput, JSON.stringify({
      recipeId: recipe.id,
      blobName: payload.raw_image_blob_name
    }));
  }

  return jsonResponse(201, recipe);
});

app.http("recipesCreate", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes",
  extraOutputs: [mediaQueueOutput as any],
  handler: recipesCreate
});
