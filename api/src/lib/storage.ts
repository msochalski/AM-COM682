import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient } from "@azure/storage-blob";
import { ApiError } from "./errors";

let blobServiceClient: BlobServiceClient | null = null;

type StorageAccountInfo = {
  account: string;
  key: string;
  connectionString?: string;
};

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
  return { account, key, connectionString: value };
}

function getStorageAccountInfo(): StorageAccountInfo {
  const account = process.env.BLOB_ACCOUNT;
  const key = process.env.BLOB_KEY;
  if (account && key) {
    return { account, key };
  }

  const connectionString =
    process.env.BLOB_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage;
  if (connectionString) {
    return parseConnectionString(connectionString);
  }

  throw new ApiError(
    500,
    "Missing required storage configuration (BLOB_ACCOUNT/BLOB_KEY or BLOB_CONNECTION_STRING)",
    "config_error"
  );
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
