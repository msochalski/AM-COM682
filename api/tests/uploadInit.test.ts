import { describe, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./testUtils";

vi.mock("../src/lib/uploads", () => ({
  createUploadInit: vi.fn()
}));

describe("upload-init handler", () => {
  it("returns SAS upload details", async () => {
    const { createUploadInit } = await import("../src/lib/uploads");
    vi.mocked(createUploadInit).mockResolvedValue({
      blobName: "recipes/test.png",
      rawBlobUrl: "https://storage/raw/recipes/test.png",
      uploadUrl: "https://storage/raw/recipes/test.png?sas",
      expiresOn: "2024-01-01T00:00:00.000Z"
    });

    const { uploadInit } = await import("../src/functions/uploadInit");
    const response = await uploadInit(
      makeRequest({
        method: "POST",
        body: { fileName: "test.png", contentType: "image/png" }
      }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({
      blobName: "recipes/test.png",
      rawBlobUrl: "https://storage/raw/recipes/test.png",
      uploadUrl: "https://storage/raw/recipes/test.png?sas",
      expiresOn: "2024-01-01T00:00:00.000Z"
    });
  });
});