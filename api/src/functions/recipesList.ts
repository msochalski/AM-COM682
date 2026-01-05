import { app, output, HttpRequest, InvocationContext, HttpResponseInit } from "@azure/functions";
import { jsonResponse, readJson } from "../lib/http";
import { listRecipes, createRecipe } from "../lib/recipesRepo";
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
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../lib/logger";
import { ApiError, isApiError } from "../lib/errors";

const defaultCorsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

// Queue output binding for media processing
const mediaQueueOutput = output.storageQueue({
  queueName: "media-process",
  connection: "AzureWebJobsStorage",
});

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": defaultCorsOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-correlation-id",
    "Access-Control-Allow-Credentials": "true"
  };
}

function getCorrelationId(request: HttpRequest): string {
  const header = request.headers?.get("x-correlation-id") || request.headers?.get("x-request-id");
  return header ?? uuidv4();
}

async function handleList(request: HttpRequest): Promise<HttpResponseInit> {
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
}

async function handleCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    context.extraOutputs.set(mediaQueueOutput, {
      recipeId: recipe.id,
      blobName: payload.raw_image_blob_name
    });
  }

  return jsonResponse(201, recipe);
}

function toErrorResponse(err: unknown): HttpResponseInit {
  if (isApiError(err)) {
    return jsonResponse(err.status, {
      error: err.code,
      message: err.message
    });
  }
  return jsonResponse(500, {
    error: "internal_error",
    message: "Internal server error"
  });
}

// Combined handler for GET and POST on /api/v1/recipes
async function recipesHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  const logger = createLogger(context, correlationId);
  const corsHeaders = getCorsHeaders();

  logger.info("Request received", {
    method: request.method,
    url: request.url
  });

  const addHeaders = (response: HttpResponseInit): HttpResponseInit => ({
    ...response,
    headers: {
      ...(response.headers ?? {}),
      ...corsHeaders,
      "x-correlation-id": correlationId
    }
  });

  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: { ...corsHeaders, "x-correlation-id": correlationId }
    };
  }

  try {
    if (request.method === "GET") {
      return addHeaders(await handleList(request));
    } else if (request.method === "POST") {
      return addHeaders(await handleCreate(request, context));
    }
    return addHeaders(jsonResponse(405, { error: "method_not_allowed" }));
  } catch (err) {
    logger.error("Request failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    return addHeaders(toErrorResponse(err));
  }
}

app.http("recipes", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/dishes",
  extraOutputs: [mediaQueueOutput],
  handler: recipesHandler
});

// Timestamp: 2026-01-05T18:20
