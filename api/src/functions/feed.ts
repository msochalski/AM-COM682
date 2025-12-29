import { app } from "@azure/functions";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { getFeedPage } from "../lib/cosmosRepo";
import { readPositiveInt } from "../lib/validation";

export const feed = createHttpHandler(async (request) => {
  const page = readPositiveInt(request.query.get("page"), "page", {
    defaultValue: 1,
    min: 1
  });
  const pageSize = readPositiveInt(request.query.get("pageSize"), "pageSize", {
    defaultValue: 20,
    min: 1,
    max: 100
  });

  const items = await getFeedPage(page, pageSize);
  return jsonResponse(200, { items, page, pageSize });
});

app.http("feed", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/feed",
  handler: feed
});
