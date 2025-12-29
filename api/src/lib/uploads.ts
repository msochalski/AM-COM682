import path from "path";
import { v4 as uuidv4 } from "uuid";
import { BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol } from "@azure/storage-blob";
import { getRawContainerClient, getStorageCredential } from "./storage";

const allowedExtensions = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

function resolveExtension(fileName?: string, contentType?: string): string {
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) {
      return ext;
    }
  }

  if (contentType && allowedExtensions.has(contentType)) {
    return allowedExtensions.get(contentType) as string;
  }

  return ".bin";
}

export type UploadInitInput = {
  fileName?: string;
  contentType?: string;
};

export async function createUploadInit(input: UploadInitInput) {
  const extension = resolveExtension(input.fileName, input.contentType);
  const blobName = `recipes/${uuidv4()}${extension}`;
  const container = await getRawContainerClient();
  const blobClient = container.getBlobClient(blobName);

  const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: container.containerName,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn: new Date(Date.now() - 5 * 1000),
      expiresOn,
      protocol: SASProtocol.Https
    },
    getStorageCredential()
  ).toString();

  return {
    blobName,
    rawBlobUrl: blobClient.url,
    uploadUrl: `${blobClient.url}?${sas}`,
    expiresOn: expiresOn.toISOString()
  };
}