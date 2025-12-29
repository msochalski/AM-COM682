import { v4 as uuidv4 } from "uuid";
import { getCosmosContainers } from "./cosmos";

export type FeedItem = {
  id: string;
  pk: "feed";
  recipeId: string;
  title: string;
  imageThumbUrl?: string | null;
  createdAt: string;
};

export type CommentItem = {
  id: string;
  recipeId: string;
  userId: string;
  text: string;
  createdAt: string;
};

export async function getFeedPage(page: number, pageSize: number) {
  const { feed } = getCosmosContainers();
  const offset = (page - 1) * pageSize;

  const query = {
    query: "SELECT * FROM c WHERE c.pk = 'feed' ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit",
    parameters: [
      { name: "@offset", value: offset },
      { name: "@limit", value: pageSize }
    ]
  };

  const { resources } = await feed.items
    .query<FeedItem>(query, { partitionKey: "feed" } as any)
    .fetchAll();
  return resources;
}

export async function upsertFeedItem(item: FeedItem) {
  const { feed } = getCosmosContainers();
  await feed.items.upsert(item, { partitionKey: "feed" } as any);
}

export async function deleteFeedItem(recipeId: string) {
  const { feed } = getCosmosContainers();
  await feed.item(recipeId, "feed").delete();
}

export async function addComment(recipeId: string, userId: string, text: string): Promise<CommentItem> {
  const { comments } = getCosmosContainers();
  const comment: CommentItem = {
    id: uuidv4(),
    recipeId,
    userId,
    text,
    createdAt: new Date().toISOString()
  };

  await comments.items.create(comment, { partitionKey: recipeId } as any);
  return comment;
}

export async function getComments(recipeId: string, page: number, pageSize: number) {
  const { comments } = getCosmosContainers();
  const offset = (page - 1) * pageSize;

  const query = {
    query: "SELECT * FROM c WHERE c.recipeId = @recipeId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit",
    parameters: [
      { name: "@recipeId", value: recipeId },
      { name: "@offset", value: offset },
      { name: "@limit", value: pageSize }
    ]
  };

  const { resources } = await comments.items
    .query<CommentItem>(query, { partitionKey: recipeId } as any)
    .fetchAll();

  return resources;
}

export async function deleteCommentsForRecipe(recipeId: string) {
  const { comments } = getCosmosContainers();
  const query = {
    query: "SELECT c.id FROM c WHERE c.recipeId = @recipeId",
    parameters: [{ name: "@recipeId", value: recipeId }]
  };

  const { resources } = await comments.items
    .query<{ id: string }>(query, { partitionKey: recipeId } as any)
    .fetchAll();

  for (const item of resources) {
    await comments.item(item.id, recipeId).delete();
  }
}
