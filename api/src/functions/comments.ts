import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { addComment, getComments } from "../lib/cosmosRepo";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { asRecord, readPositiveInt, readString } from "../lib/validation";

export const commentsCreate = createHttpHandler(async (request) => {
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

export const commentsList = createHttpHandler(async (request) => {
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

app.http("commentsCreate", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/comments",
  handler: commentsCreate
});

app.http("commentsList", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/recipes/{id}/comments",
  handler: commentsList
});
