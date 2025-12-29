import { InvocationContext } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { upsertFeedItem, FeedItem } from "../lib/cosmosRepo";
import { generateImages } from "../lib/image";
import { getProcessedBlobNames } from "../lib/media";
import { getRecipeById, setRecipeImages } from "../lib/recipesRepo";
import { getProcessedContainerClient, getRawContainerClient } from "../lib/storage";

export type MediaJob = {
  recipeId: string;
  blobName: string;
};

export type MediaProcessorDeps = {
  downloadRawBlob: (blobName: string) => Promise<Buffer>;
  uploadProcessedBlob: (name: string, data: Buffer) => Promise<string>;
  generateImages: (buffer: Buffer) => Promise<{ thumb: Buffer; main: Buffer }>;
  updateRecipeImages: (recipeId: string, imageUrl: string, thumbUrl: string) => Promise<void>;
  getRecipeDetails: (recipeId: string) => Promise<Record<string, unknown> | null>;
  upsertFeedItem: (item: FeedItem) => Promise<void>;
  buildProcessedNames: (recipeId: string) => { thumbName: string; imageName: string };
};

const defaultDeps: MediaProcessorDeps = {
  downloadRawBlob: async (blobName) => {
    const container = await getRawContainerClient();
    const blob = container.getBlobClient(blobName);
    return blob.downloadToBuffer();
  },
  uploadProcessedBlob: async (name, data) => {
    const container = await getProcessedContainerClient();
    const blob = container.getBlockBlobClient(name);
    await blob.uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: "image/webp",
        blobCacheControl: "public, max-age=31536000"
      }
    });
    return blob.url;
  },
  generateImages,
  updateRecipeImages: setRecipeImages,
  getRecipeDetails: getRecipeById,
  upsertFeedItem,
  buildProcessedNames: getProcessedBlobNames
};

export function createMediaProcessor(deps: MediaProcessorDeps) {
  return async (job: MediaJob, context?: InvocationContext) => {
    if (!job.recipeId || !job.blobName) {
      throw new ApiError(400, "Invalid media job payload", "invalid_job");
    }

    context?.log({
      message: "Processing media",
      recipeId: job.recipeId,
      blobName: job.blobName
    });

    const buffer = await deps.downloadRawBlob(job.blobName);
    const { thumb, main } = await deps.generateImages(buffer);
    const { thumbName, imageName } = deps.buildProcessedNames(job.recipeId);

    const [thumbUrl, imageUrl] = await Promise.all([
      deps.uploadProcessedBlob(thumbName, thumb),
      deps.uploadProcessedBlob(imageName, main)
    ]);

    await deps.updateRecipeImages(job.recipeId, imageUrl, thumbUrl);

    const recipe = await deps.getRecipeDetails(job.recipeId);
    if (!recipe) {
      throw new ApiError(404, "Recipe not found for media processing", "not_found");
    }

    const title = String(recipe.title ?? "Untitled");
    const createdAtRaw = recipe.created_at as Date | string | undefined;
    const createdAt = createdAtRaw
      ? new Date(createdAtRaw).toISOString()
      : new Date().toISOString();

    const feedItem: FeedItem = {
      id: job.recipeId,
      pk: "feed",
      recipeId: job.recipeId,
      title,
      imageThumbUrl: thumbUrl,
      createdAt
    };

    await deps.upsertFeedItem(feedItem);

    return {
      recipeId: job.recipeId,
      imageUrl,
      thumbUrl
    };
  };
}

export async function processMediaJob(job: MediaJob, context?: InvocationContext) {
  const processor = createMediaProcessor(defaultDeps);
  return processor(job, context);
}
