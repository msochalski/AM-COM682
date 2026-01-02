// Get API base URL from environment variable with fallback for local development
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:7071";

function buildUrl(path: string) {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}${path}`;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {})
    },
    credentials: "include"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type FeedItem = {
  id: string;
  recipeId: string;
  title: string;
  imageThumbUrl?: string | null;
  createdAt: string;
  tags: string[];
  ratingAvg: number;
};

export type Recipe = {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  raw_image_blob_name?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  is_published?: boolean;
  moderation_status?: string;
  categories?: string[];
  ingredients?: { name: string; quantity?: string | null }[];
  created_at?: string;
  updated_at?: string;
};

export type Comment = {
  id: string;
  recipeId: string;
  userId: string;
  text: string;
  createdAt: string;
};

export async function getFeed(page = 1, pageSize = 20) {
  return apiRequest<{ items: FeedItem[] }>(`/api/v1/feed?page=${page}&pageSize=${pageSize}`);
}

export async function listRecipes(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  return apiRequest<{ items: Recipe[] }>(`/api/v1/recipes?${query.toString()}`);
}

export async function getRecipe(id: string) {
  return apiRequest<Recipe>(`/api/v1/recipes/${id}`);
}

export async function createRecipe(payload: Record<string, unknown>) {
  return apiRequest<Recipe>("/api/v1/recipes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateRecipe(id: string, payload: Record<string, unknown>) {
  return apiRequest<Recipe>(`/api/v1/recipes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteRecipe(id: string) {
  return apiRequest<{ deleted: boolean }>(`/api/v1/recipes/${id}`, {
    method: "DELETE"
  });
}

export async function publishRecipe(id: string) {
  return apiRequest<{ id: string }>(`/api/v1/recipes/${id}/publish`, {
    method: "POST"
  });
}

export async function addComment(recipeId: string, text: string, userId?: string) {
  return apiRequest<Comment>(`/api/v1/recipes/${recipeId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text, user_id: userId })
  });
}

export async function getComments(recipeId: string, page = 1, pageSize = 20) {
  return apiRequest<{ items: Comment[] }>(
    `/api/v1/recipes/${recipeId}/comments?page=${page}&pageSize=${pageSize}`
  );
}

export async function uploadInit(file: File) {
  return apiRequest<{ uploadUrl: string; blobName: string; rawBlobUrl: string }>("/api/v1/upload-init", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type })
  });
}

export async function uploadToSas(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "content-type": file.type
    },
    body: file
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Upload failed");
  }
}