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
