import sql from "mssql";
import { ApiError } from "./errors";

let pool: sql.ConnectionPool | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `Missing required env: ${name}`, "config_error");
  }
  return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function getSqlConfig(): sql.config {
  const server = requireEnv("SQL_SERVER");
  const database = requireEnv("SQL_DATABASE");
  const user = requireEnv("SQL_USER");
  const password = requireEnv("SQL_PASSWORD");
  const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined;

  return {
    user,
    password,
    server,
    database,
    port,
    options: {
      encrypt: parseBoolean(process.env.SQL_ENCRYPT, true),
      trustServerCertificate: parseBoolean(process.env.SQL_TRUST_CERT, false)
    }
  };
}

export async function getSqlPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  pool = await sql.connect(getSqlConfig());
  return pool;
}

export async function query<T = unknown>(
  statement: string,
  params?: Record<string, unknown>,
  transaction?: sql.Transaction
): Promise<sql.IResult<T>> {
  const pool = await getSqlPool();
  const request = transaction ? new sql.Request(transaction) : pool.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as never);
    }
  }

  return request.query<T>(statement);
}

export async function withTransaction<T>(
  callback: (transaction: sql.Transaction) => Promise<T>
): Promise<T> {
  const pool = await getSqlPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export { sql };