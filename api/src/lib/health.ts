import { getCosmosClient } from "./cosmos";
import { getSqlPool } from "./sql";
import { getBlobServiceClient } from "./storage";
import { QueueServiceClient, StorageSharedKeyCredential } from "@azure/storage-queue";

export type HealthCheckResult = {
  ok: boolean;
  error?: string;
};

export type HealthResponse = {
  ok: boolean;
  checks: {
    sql: HealthCheckResult;
    cosmos: HealthCheckResult;
    blob: HealthCheckResult;
    queue: HealthCheckResult;
  };
};

/**
 * Sanitize error for logging - strip any secrets/connection strings
 */
function sanitizeErrorForLog(error: unknown): { name: string; message: string; stack?: string } {
  const err = error instanceof Error ? error : new Error(String(error));
  // Mask potential secrets in error messages
  const sensitivePatterns = [
    /AccountKey=[^;]+/gi,
    /password=[^;]+/gi,
    /key=[^;]+/gi,
    /secret=[^;]+/gi,
    /connectionstring=[^;]+/gi,
    /sig=[^&]+/gi,
  ];
  
  let message = err.message;
  let stack = err.stack ?? "";
  
  for (const pattern of sensitivePatterns) {
    message = message.replace(pattern, "[REDACTED]");
    stack = stack.replace(pattern, "[REDACTED]");
  }
  
  // Only first ~10 lines of stack
  const stackLines = stack.split("\n").slice(0, 10).join("\n");
  
  return {
    name: err.name,
    message,
    stack: stackLines
  };
}

async function checkSql(): Promise<HealthCheckResult> {
  const requiredVars = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      return { ok: false, error: `Missing env var: ${v}` };
    }
  }
  
  try {
    const pool = await getSqlPool();
    await pool.request().query("SELECT 1 AS ok");
    return { ok: true };
  } catch (error) {
    const sanitized = sanitizeErrorForLog(error);
    return { ok: false, error: sanitized.message };
  }
}

async function checkCosmos(): Promise<HealthCheckResult> {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const db = process.env.COSMOS_DB || process.env.COSMOS_DATABASE;
  
  if (!endpoint) return { ok: false, error: "Missing env var: COSMOS_ENDPOINT" };
  if (!key) return { ok: false, error: "Missing env var: COSMOS_KEY" };
  if (!db) return { ok: false, error: "Missing env var: COSMOS_DB" };
  
  try {
    const client = getCosmosClient();
    // Read the database to verify connectivity
    await client.database(db).read();
    return { ok: true };
  } catch (error) {
    const sanitized = sanitizeErrorForLog(error);
    return { ok: false, error: sanitized.message };
  }
}

async function checkBlob(): Promise<HealthCheckResult> {
  const account = process.env.BLOB_ACCOUNT;
  const key = process.env.BLOB_KEY;
  const connString = process.env.BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  
  if (!account && !connString) {
    return { ok: false, error: "Missing env var: BLOB_ACCOUNT or BLOB_CONNECTION_STRING" };
  }
  if (account && !key && !connString) {
    return { ok: false, error: "Missing env var: BLOB_KEY" };
  }
  
  const rawContainer = process.env.RAW_CONTAINER ?? "raw";
  const processedContainer = process.env.PROCESSED_CONTAINER ?? "processed";
  
  try {
    const blobService = getBlobServiceClient();
    
    // Check both containers exist
    const rawClient = blobService.getContainerClient(rawContainer);
    const processedClient = blobService.getContainerClient(processedContainer);
    
    const [rawExists, processedExists] = await Promise.all([
      rawClient.exists(),
      processedClient.exists()
    ]);
    
    if (!rawExists) {
      return { ok: false, error: `Container not found: ${rawContainer}` };
    }
    if (!processedExists) {
      return { ok: false, error: `Container not found: ${processedContainer}` };
    }
    
    return { ok: true };
  } catch (error) {
    const sanitized = sanitizeErrorForLog(error);
    return { ok: false, error: sanitized.message };
  }
}

async function checkQueue(): Promise<HealthCheckResult> {
  const account = process.env.BLOB_ACCOUNT;
  const key = process.env.BLOB_KEY;
  const connString = process.env.BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  
  if (!account && !connString) {
    return { ok: false, error: "Missing env var: BLOB_ACCOUNT or connection string for queue" };
  }
  if (account && !key && !connString) {
    return { ok: false, error: "Missing env var: BLOB_KEY" };
  }
  
  const queueName = process.env.MEDIA_QUEUE ?? "media-process";
  
  try {
    let queueService: QueueServiceClient;
    
    if (connString) {
      queueService = QueueServiceClient.fromConnectionString(connString);
    } else {
      const credential = new StorageSharedKeyCredential(account!, key!);
      queueService = new QueueServiceClient(
        `https://${account}.queue.core.windows.net`,
        credential
      );
    }
    
    const queueClient = queueService.getQueueClient(queueName);
    const exists = await queueClient.exists();
    
    if (!exists) {
      return { ok: false, error: `Queue not found: ${queueName}` };
    }
    
    return { ok: true };
  } catch (error) {
    const sanitized = sanitizeErrorForLog(error);
    return { ok: false, error: sanitized.message };
  }
}

export type HealthLogInfo = {
  dependency: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
};

export async function checkHealth(): Promise<{ response: HealthResponse; failedLogs: HealthLogInfo[] }> {
  const [sql, cosmos, blob, queue] = await Promise.all([
    checkSql(),
    checkCosmos(),
    checkBlob(),
    checkQueue()
  ]);
  
  const checks = { sql, cosmos, blob, queue };
  const allOk = sql.ok && cosmos.ok && blob.ok && queue.ok;
  
  const failedLogs: HealthLogInfo[] = [];
  
  for (const [name, result] of Object.entries(checks)) {
    if (!result.ok && result.error) {
      failedLogs.push({
        dependency: name,
        errorName: "HealthCheckError",
        errorMessage: result.error,
        errorStack: undefined
      });
    }
  }
  
  return {
    response: { ok: allOk, checks },
    failedLogs
  };
}

/**
 * Legacy function for backward compatibility with tests
 */
export async function checkSqlConnection(): Promise<void> {
  const result = await checkSql();
  if (!result.ok) {
    throw new Error(result.error);
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function checkCosmosConnection(): Promise<void> {
  const result = await checkCosmos();
  if (!result.ok) {
    throw new Error(result.error);
  }
}