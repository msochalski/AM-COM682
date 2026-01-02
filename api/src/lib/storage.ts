import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient } from "@azure/storage-blob";
import { ApiError } from "./errors";

let blobServiceClient: BlobServiceClient | null = null;

export type StorageAuthMode = "connection-string" | "shared-key";

type StorageAccountInfo = {
  account: string;
  key: string;
  connectionString?: string;
  authMode: StorageAuthMode;
};

/**
 * Validates that BLOB_KEY is not accidentally a connection string
 */
function validateBlobKey(key: string): void {
  if (key.includes("DefaultEndpointsProtocol=") || key.includes("AccountKey=")) {
    throw new ApiError(
      500,
      "BLOB_KEY appears to be a connection string. Please use the Access Key value instead (found in Azure Portal -> Storage Account -> Access keys -> Key 1 or Key 2). If you want to use a connection string, set AzureWebJobsStorage instead.",
      "config_error"
    );
  }
}

function parseConnectionString(value: string): StorageAccountInfo {
  const parts = value.split(";").map((part) => part.trim()).filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) {
      continue;
    }
    map.set(key, rest.join("="));
  }
  const account = map.get("AccountName");
  const key = map.get("AccountKey");
  if (!account || !key) {
    throw new ApiError(500, "Invalid storage connection string", "config_error");
  }
  return { account, key, connectionString: value, authMode: "connection-string" };
}

function getStorageAccountInfo(): StorageAccountInfo {
  // Priority 1: AzureWebJobsStorage connection string (preferred for Azure Functions)
  const azureWebJobsStorage = process.env.AzureWebJobsStorage;
  if (azureWebJobsStorage) {
    return parseConnectionString(azureWebJobsStorage);
  }

  // Priority 2: Other connection string env vars
  const connectionString =
    process.env.BLOB_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    return parseConnectionString(connectionString);
  }

  // Priority 3: BLOB_ACCOUNT + BLOB_KEY (shared key credential)
  const account = process.env.BLOB_ACCOUNT;
  const key = process.env.BLOB_KEY;
  if (account && key) {
    validateBlobKey(key);
    return { account, key, authMode: "shared-key" };
  }

  throw new ApiError(
    500,
    "Missing required storage configuration. Set AzureWebJobsStorage (connection string) or BLOB_ACCOUNT + BLOB_KEY (access key).",
    "config_error"
  );
}

/**
 * Returns the current storage authentication mode for health reporting
 */
export function getStorageAuthMode(): { authMode: StorageAuthMode; account: string } {
  const info = getStorageAccountInfo();
  return { authMode: info.authMode, account: info.account };
}

export function getStorageCredential(): StorageSharedKeyCredential {
  const info = getStorageAccountInfo();
  return new StorageSharedKeyCredential(info.account, info.key);
}

export function getBlobServiceClient(): BlobServiceClient {
  if (blobServiceClient) {
    return blobServiceClient;
  }

  const info = getStorageAccountInfo();
  if (info.connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(info.connectionString);
  } else {
    const credential = getStorageCredential();
    blobServiceClient = new BlobServiceClient(
      `https://${info.account}.blob.core.windows.net`,
      credential
    );
  }

  return blobServiceClient;
}

export async function getContainerClient(name: string): Promise<ContainerClient> {
  const client = getBlobServiceClient().getContainerClient(name);
  await client.createIfNotExists();
  return client;
}

export async function getRawContainerClient(): Promise<ContainerClient> {
  const name = process.env.RAW_CONTAINER ?? "raw";
  return getContainerClient(name);
}

export async function getProcessedContainerClient(): Promise<ContainerClient> {
  const name = process.env.PROCESSED_CONTAINER ?? "processed";
  return getContainerClient(name);
}
