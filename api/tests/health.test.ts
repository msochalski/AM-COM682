import { describe, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./testUtils";

vi.mock("../src/lib/health", () => ({
  checkHealth: vi.fn()
}));

describe("health handler", () => {
  it("returns ok when all dependencies are healthy", async () => {
    const { checkHealth } = await import("../src/lib/health");
    vi.mocked(checkHealth).mockResolvedValue({
      response: {
        ok: true,
        checks: {
          sql: { ok: true },
          cosmos: { ok: true },
          blob: { ok: true },
          queue: { ok: true }
        }
      },
      failedLogs: []
    });

    const { health } = await import("../src/functions/health");
    const response = await health(makeRequest({ method: "GET" }), makeContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toHaveProperty("ok", true);
    expect(response.jsonBody).toHaveProperty("checks");
  });

  it("returns 503 when any dependency fails", async () => {
    const { checkHealth } = await import("../src/lib/health");
    vi.mocked(checkHealth).mockResolvedValue({
      response: {
        ok: false,
        checks: {
          sql: { ok: false, error: "Connection failed" },
          cosmos: { ok: true },
          blob: { ok: true },
          queue: { ok: true }
        }
      },
      failedLogs: [
        { dependency: "sql", errorName: "HealthCheckError", errorMessage: "Connection failed" }
      ]
    });

    const { health } = await import("../src/functions/health");
    const response = await health(makeRequest({ method: "GET" }), makeContext());

    expect(response.status).toBe(503);
    expect(response.jsonBody).toHaveProperty("ok", false);
    expect(response.jsonBody).toHaveProperty("checks.sql.ok", false);
    expect(response.jsonBody).toHaveProperty("checks.sql.error", "Connection failed");
  });

  it("returns check details for missing env vars", async () => {
    const { checkHealth } = await import("../src/lib/health");
    vi.mocked(checkHealth).mockResolvedValue({
      response: {
        ok: false,
        checks: {
          sql: { ok: false, error: "Missing env var: SQL_SERVER" },
          cosmos: { ok: false, error: "Missing env var: COSMOS_ENDPOINT" },
          blob: { ok: false, error: "Missing env var: BLOB_ACCOUNT or BLOB_CONNECTION_STRING" },
          queue: { ok: false, error: "Missing env var: BLOB_ACCOUNT or connection string for queue" }
        }
      },
      failedLogs: [
        { dependency: "sql", errorName: "HealthCheckError", errorMessage: "Missing env var: SQL_SERVER" },
        { dependency: "cosmos", errorName: "HealthCheckError", errorMessage: "Missing env var: COSMOS_ENDPOINT" },
        { dependency: "blob", errorName: "HealthCheckError", errorMessage: "Missing env var: BLOB_ACCOUNT or BLOB_CONNECTION_STRING" },
        { dependency: "queue", errorName: "HealthCheckError", errorMessage: "Missing env var: BLOB_ACCOUNT or connection string for queue" }
      ]
    });

    const { health } = await import("../src/functions/health");
    const response = await health(makeRequest({ method: "GET" }), makeContext());

    expect(response.status).toBe(503);
    expect(response.jsonBody).toHaveProperty("ok", false);
  });
});
