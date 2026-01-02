import { app } from "@azure/functions";
import { createHttpHandler, jsonResponse } from "../lib/http";

// Build-time version info embedded during CI/CD
// These are replaced by the build process or read from environment
const VERSION = process.env.APP_VERSION || "1.0.0";
const COMMIT_SHA = process.env.COMMIT_SHA || process.env.GITHUB_SHA || "unknown";
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

export const version = createHttpHandler(async () => {
  return jsonResponse(200, {
    version: VERSION,
    commit: COMMIT_SHA,
    buildTime: BUILD_TIME,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

app.http("version", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/version",
  handler: version
});
