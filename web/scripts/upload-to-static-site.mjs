/**
 * Upload script for deploying Vite build output to Azure Storage Static Website ($web container)
 * Uses @azure/storage-blob SDK with Storage Key authentication (no Azure CLI required)
 * 
 * Required environment variables:
 * - AZURE_STORAGE_ACCOUNT: Storage account name
 * - AZURE_STORAGE_KEY: Storage account key
 */

import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { readdir, readFile, stat } from "fs/promises";
import { join, extname, relative, posix } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DIST_DIR = join(__dirname, "..", "dist");
const CONTAINER_NAME = "$web";

// Content type mappings
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};

// Cache control settings
// HTML files should not be cached aggressively (SPA routing)
// Hashed assets can be cached forever (immutable)
function getCacheControl(filename) {
  const ext = extname(filename).toLowerCase();
  
  // HTML files - don't cache
  if (ext === ".html") {
    return "no-cache, no-store, must-revalidate";
  }
  
  // Check if filename contains a hash pattern (Vite uses . followed by hash)
  // Examples: main.abc123.js, style.def456.css
  const hashPattern = /\.[a-f0-9]{8,}\.(js|css|mjs)$/i;
  if (hashPattern.test(filename)) {
    return "public, max-age=31536000, immutable";
  }
  
  // Other static assets - cache for a day
  return "public, max-age=86400";
}

function getContentType(filename) {
  const ext = extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // Get path relative to base directory
      const relativePath = relative(baseDir, fullPath);
      // Convert to forward slashes for blob names
      const blobName = relativePath.split("\\").join("/");
      files.push({ localPath: fullPath, blobName });
    }
  }
  
  return files;
}

async function main() {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  
  if (!account) {
    console.error("ERROR: AZURE_STORAGE_ACCOUNT environment variable is required");
    process.exit(1);
  }
  if (!key) {
    console.error("ERROR: AZURE_STORAGE_KEY environment variable is required");
    process.exit(1);
  }
  
  console.log(`\n📦 Uploading to Azure Storage Static Website`);
  console.log(`   Account: ${account}`);
  console.log(`   Container: ${CONTAINER_NAME}`);
  console.log(`   Source: ${DIST_DIR}\n`);
  
  // Create blob service client with shared key credential
  const credential = new StorageSharedKeyCredential(account, key);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  );
  
  // Get container client for $web
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  
  // Check if container exists
  const exists = await containerClient.exists();
  if (!exists) {
    console.error(`ERROR: Container '${CONTAINER_NAME}' does not exist.`);
    console.error("Please enable static website hosting in the Azure Portal:");
    console.error("  Storage Account -> Static website -> Enable");
    process.exit(1);
  }
  
  // Get all files from dist directory
  let files;
  try {
    files = await getAllFiles(DIST_DIR);
  } catch (err) {
    console.error(`ERROR: Could not read dist directory: ${DIST_DIR}`);
    console.error("Make sure to run 'npm run build' first.");
    process.exit(1);
  }
  
  if (files.length === 0) {
    console.error("ERROR: No files found in dist directory");
    process.exit(1);
  }
  
  console.log(`Found ${files.length} files to upload\n`);
  
  let uploaded = 0;
  let errors = 0;
  
  for (const { localPath, blobName } of files) {
    const contentType = getContentType(blobName);
    const cacheControl = getCacheControl(blobName);
    
    try {
      const content = await readFile(localPath);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: cacheControl,
        },
      });
      
      console.log(`✅ ${blobName} (${contentType})`);
      uploaded++;
    } catch (err) {
      console.error(`❌ ${blobName}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Errors: ${errors}`);
  
  if (errors > 0) {
    console.error("\n⚠️  Some files failed to upload");
    process.exit(1);
  }
  
  console.log(`\n🌐 Static website URL: https://${account}.z6.web.core.windows.net/`);
  console.log("✨ Deployment complete!\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
