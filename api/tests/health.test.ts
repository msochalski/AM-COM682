import { describe, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./testUtils";

vi.mock("../src/lib/health", () => ({
  checkHealth: vi.fn()
}));

describe("health handler", () => {
  it("returns ok when dependencies are healthy", async () => {
    const { checkHealth } = await import("../src/lib/health");
    vi.mocked(checkHealth).mockResolvedValue(undefined);

    const { health } = await import("../src/functions/health");
    const response = await health(makeRequest({ method: "GET" }), makeContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ ok: true });
  });

  it("returns 503 when dependencies fail", async () => {
    const { checkHealth } = await import("../src/lib/health");
    vi.mocked(checkHealth).mockRejectedValue(new Error("fail"));

    const { health } = await import("../src/functions/health");
    const response = await health(makeRequest({ method: "GET" }), makeContext());

    expect(response.status).toBe(503);
  });
});
