import { checkCosmosConnection } from "./cosmos";
import { getSqlPool } from "./sql";

export async function checkSqlConnection(): Promise<void> {
  const pool = await getSqlPool();
  await pool.request().query("SELECT 1 AS ok");
}

export async function checkHealth(): Promise<void> {
  await Promise.all([checkSqlConnection(), checkCosmosConnection()]);
}