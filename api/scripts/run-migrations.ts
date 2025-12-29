import fs from "fs";
import path from "path";
import sql from "mssql";
import { getSqlConfig } from "../src/lib/sql";

async function runMigrations() {
  const config = getSqlConfig();
  const pool = await sql.connect(config);

  const migrationsDir = path.join(__dirname, "..", "sql");
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const name = file;
    const exists = await pool.request()
      .input("name", sql.NVarChar, name)
      .query("IF OBJECT_ID('schema_migrations', 'U') IS NULL SELECT 0 AS applied ELSE SELECT COUNT(1) AS applied FROM dbo.schema_migrations WHERE name = @name");
    const applied = exists.recordset[0].applied as number;
    if (applied > 0) {
      // Already applied.
      continue;
    }

    const sqlText = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sqlText);
    await pool.request()
      .input("name", sql.NVarChar, name)
      .query("INSERT INTO dbo.schema_migrations(name) VALUES (@name)");

    console.log(`Applied migration ${name}`);
  }

  await pool.close();
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
