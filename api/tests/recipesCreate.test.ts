import { describe, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./testUtils";

vi.mock("../src/lib/recipesRepo", () => ({
  createRecipe: vi.fn()
}));

describe("recipes create handler", () => {
  it("creates a recipe and returns it", async () => {
    const { createRecipe } = await import("../src/lib/recipesRepo");
    vi.mocked(createRecipe).mockResolvedValue({
      id: "recipe-1",
      title: "Test Recipe"
    });

    const { recipesCreate } = await import("../src/functions/recipesCreate");
    const response = await recipesCreate(
      makeRequest({
        method: "POST",
        body: { title: "Test Recipe" }
      }),
      makeContext()
    );

    expect(response.status).toBe(201);
    expect(response.jsonBody).toEqual({
      id: "recipe-1",
      title: "Test Recipe"
    });
  });
});
