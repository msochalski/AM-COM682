import { CosmosClient, Container } from "@azure/cosmos";
import { ApiError } from "./errors";

let client: CosmosClient | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `Missing required env: ${name}`, "config_error");
  }
  return value;
}

export type CosmosContainers = {
  feed: Container;
  comments: Container;
  tags?: Container;
};

export function getCosmosClient(): CosmosClient {
  if (client) {
    return client;
  }

  const endpoint = requireEnv("COSMOS_ENDPOINT");
  const key = requireEnv("COSMOS_KEY");
  client = new CosmosClient({ endpoint, key });
  return client;
}

export function getCosmosContainers(): CosmosContainers {
  const dbName = process.env.COSMOS_DB || process.env.COSMOS_DATABASE;
  if (!dbName) {
    throw new ApiError(500, "Missing required env: COSMOS_DB", "config_error");
  }
  const feedContainer = process.env.COSMOS_FEED_CONTAINER ?? "feed";
  const commentsContainer = process.env.COSMOS_COMMENTS_CONTAINER ?? "comments";
  const tagsContainer = process.env.COSMOS_TAGS_CONTAINER ?? "tags";

  const database = getCosmosClient().database(dbName);

  return {
    feed: database.container(feedContainer),
    comments: database.container(commentsContainer),
    tags: tagsContainer ? database.container(tagsContainer) : undefined
  };
}

export async function checkCosmosConnection(): Promise<void> {
  const dbName = process.env.COSMOS_DB || process.env.COSMOS_DATABASE;
  if (!dbName) {
    throw new ApiError(500, "Missing required env: COSMOS_DB", "config_error");
  }
  await getCosmosClient().database(dbName).read();
}
