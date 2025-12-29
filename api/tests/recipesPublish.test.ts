import { describe, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./testUtils";

vi.mock("../src/lib/recipesRepo", () => ({
  setPublishStatus: vi.fn()
}));

vi.mock("../src/lib/logicApp", () => ({
  callLogicAppWebhook: vi.fn()
}));

describe("recipes publish handler", () => {
  it("publishes recipe and calls webhook", async () => {
    process.env.LOGICAPP_WEBHOOK_URL = "https://logicapp.test";

    const { setPublishStatus } = await import("../src/lib/recipesRepo");
    vi.mocked(setPublishStatus).mockResolvedValue({
      id: "recipe-1",
      title: "Test Recipe",
      moderation_status: "pending",
      is_published: true
    });

    const { callLogicAppWebhook } = await import("../src/lib/logicApp");
    vi.mocked(callLogicAppWebhook).mockResolvedValue(undefined);

    const { recipesPublish } = await import("../src/functions/recipesPublish");
    const response = await recipesPublish(
      makeRequest({ method: "POST", params: { id: "recipe-1" } }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(callLogicAppWebhook).toHaveBeenCalled();
  });
});
