import { app } from "@azure/functions";
import { ApiError } from "../lib/errors";
import { createHttpHandler, jsonResponse } from "../lib/http";
import { getSqlPool } from "../lib/sql";
import { createLogger } from "../lib/logger";

// Embedded SQL init script - this is the only SQL that can be executed
// This is the content of api/sql/001_init.sql
const INIT_SQL = `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
BEGIN
  CREATE TABLE dbo.schema_migrations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
  CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(100) NULL,
    email NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX IX_users_email ON dbo.users(email) WHERE email IS NOT NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'recipes')
BEGIN
  CREATE TABLE dbo.recipes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(2000) NULL,
    instructions NVARCHAR(MAX) NULL,
    raw_image_blob_name NVARCHAR(400) NULL,
    image_url NVARCHAR(800) NULL,
    thumb_url NVARCHAR(800) NULL,
    is_published BIT NOT NULL DEFAULT 0,
    moderation_status NVARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_recipes_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
  );
  CREATE INDEX IX_recipes_created_at ON dbo.recipes(created_at DESC);
  CREATE INDEX IX_recipes_is_published ON dbo.recipes(is_published);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'reviews')
BEGIN
  CREATE TABLE dbo.reviews (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    recipe_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NULL,
    rating INT NOT NULL,
    review_text NVARCHAR(2000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_reviews_recipes FOREIGN KEY (recipe_id) REFERENCES dbo.recipes(id),
    CONSTRAINT FK_reviews_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
  );
  CREATE INDEX IX_reviews_recipe_id ON dbo.reviews(recipe_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'favorites')
BEGIN
  CREATE TABLE dbo.favorites (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    recipe_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_favorites_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_favorites_recipes FOREIGN KEY (recipe_id) REFERENCES dbo.recipes(id)
  );
  CREATE UNIQUE INDEX UX_favorites_user_recipe ON dbo.favorites(user_id, recipe_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ingredients')
BEGIN
  CREATE TABLE dbo.ingredients (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_ingredients_name ON dbo.ingredients(name);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'recipe_ingredients')
BEGIN
  CREATE TABLE dbo.recipe_ingredients (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    recipe_id UNIQUEIDENTIFIER NOT NULL,
    ingredient_id UNIQUEIDENTIFIER NOT NULL,
    quantity NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_recipe_ingredients_recipes FOREIGN KEY (recipe_id) REFERENCES dbo.recipes(id),
    CONSTRAINT FK_recipe_ingredients_ingredients FOREIGN KEY (ingredient_id) REFERENCES dbo.ingredients(id)
  );
  CREATE UNIQUE INDEX UX_recipe_ingredients ON dbo.recipe_ingredients(recipe_id, ingredient_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
BEGIN
  CREATE TABLE dbo.categories (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_categories_name ON dbo.categories(name);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'recipe_categories')
BEGIN
  CREATE TABLE dbo.recipe_categories (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    recipe_id UNIQUEIDENTIFIER NOT NULL,
    category_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_recipe_categories_recipes FOREIGN KEY (recipe_id) REFERENCES dbo.recipes(id),
    CONSTRAINT FK_recipe_categories_categories FOREIGN KEY (category_id) REFERENCES dbo.categories(id)
  );
  CREATE UNIQUE INDEX UX_recipe_categories ON dbo.recipe_categories(recipe_id, category_id);
END;
`;

export const adminInitSql = createHttpHandler(async (request, context, correlationId) => {
  const logger = createLogger(context, correlationId);
  
  // Check admin key
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    throw new ApiError(500, "Admin endpoint not configured", "admin_not_configured");
  }
  
  const providedKey = request.headers.get("x-admin-key");
  if (!providedKey || providedKey !== adminKey) {
    logger.warn("Unauthorized admin init-sql attempt", {
      hasKey: !!providedKey,
      ip: request.headers.get("x-forwarded-for") || "unknown"
    });
    throw new ApiError(401, "Unauthorized", "unauthorized");
  }
  
  logger.info("Admin init-sql request received", {
    ip: request.headers.get("x-forwarded-for") || "unknown"
  });
  
  try {
    const pool = await getSqlPool();
    
    // Execute the init SQL (idempotent - uses IF NOT EXISTS)
    await pool.request().query(INIT_SQL);
    
    // Record migration if not already recorded
    const migrationName = "001_init.sql";
    const existsResult = await pool.request()
      .input("name", migrationName)
      .query("SELECT COUNT(*) AS cnt FROM dbo.schema_migrations WHERE name = @name");
    
    if (existsResult.recordset[0].cnt === 0) {
      await pool.request()
        .input("name", migrationName)
        .query("INSERT INTO dbo.schema_migrations (name) VALUES (@name)");
    }
    
    logger.info("Admin init-sql completed successfully");
    
    return jsonResponse(200, {
      success: true,
      message: "SQL schema initialized successfully",
      migration: migrationName
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Admin init-sql failed", {
      errorName: err.name,
      errorMessage: err.message
    });
    throw new ApiError(500, `SQL initialization failed: ${err.message}`, "sql_init_failed");
  }
});

app.http("adminInitSql", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/admin/init-sql",
  handler: adminInitSql
});
