import { describe, expect, it, vi } from "vitest";
import { createMediaProcessor, MediaProcessorDeps } from "../src/workers/mediaProcessor";

const buffer = (value: string) => Buffer.from(value, "utf8");

describe("media processor", () => {
  it("uploads images and upserts feed", async () => {
    const deps: MediaProcessorDeps = {
      downloadRawBlob: vi.fn().mockResolvedValue(buffer("raw")),
      uploadProcessedBlob: vi.fn()
        .mockResolvedValueOnce("https://storage/processed/thumb.webp")
        .mockResolvedValueOnce("https://storage/processed/image.webp"),
      generateImages: vi.fn().mockResolvedValue({
        thumb: buffer("thumb"),
        main: buffer("main")
      }),
      updateRecipeImages: vi.fn().mockResolvedValue(undefined),
      getRecipeDetails: vi.fn().mockResolvedValue({
        id: "recipe-1",
        title: "Demo",
        created_at: new Date("2024-01-01T00:00:00.000Z")
      }),
      upsertFeedItem: vi.fn().mockResolvedValue(undefined),
      buildProcessedNames: () => ({
        thumbName: "recipes/recipe-1/thumb.webp",
        imageName: "recipes/recipe-1/image.webp"
      })
    };

    const processor = createMediaProcessor(deps);
    const result = await processor({ recipeId: "recipe-1", blobName: "raw.png" });

    expect(result.imageUrl).toBe("https://storage/processed/image.webp");
    expect(result.thumbUrl).toBe("https://storage/processed/thumb.webp");
    expect(deps.uploadProcessedBlob).toHaveBeenCalledTimes(2);

    const feedItem = (deps.upsertFeedItem as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(feedItem.recipeId).toBe("recipe-1");
    expect(feedItem.pk).toBe("feed");
    expect(feedItem.imageThumbUrl).toBe("https://storage/processed/thumb.webp");
  });
});
