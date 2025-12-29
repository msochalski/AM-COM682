import { v4 as uuidv4 } from "uuid";
import { ApiError } from "./errors";
import { query, sql, withTransaction } from "./sql";

export type IngredientInput = {
  name: string;
  quantity?: string | null;
};

export type RecipeCreateInput = {
  title: string;
  description?: string | null;
  instructions?: string | null;
  rawImageBlobName?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  categories?: string[] | null;
  ingredients?: IngredientInput[] | null;
};

export type RecipeUpdateInput = {
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  rawImageBlobName?: string | null;
  categories?: string[] | null;
  ingredients?: IngredientInput[] | null;
};

export type RecipeListFilters = {
  page: number;
  pageSize: number;
  q?: string | null;
  isPublished?: boolean | null;
  category?: string | null;
};

export type RecipeDetails = Record<string, unknown> & {
  categories: string[];
  ingredients: IngredientInput[];
};

export async function createRecipe(input: RecipeCreateInput): Promise<RecipeDetails> {
  const recipeId = uuidv4();

  await withTransaction(async (tx) => {
    const userId = await ensureUser(input.userId, input.userName, input.userEmail, tx);

    await query(
      `INSERT INTO dbo.recipes (
        id, user_id, title, description, instructions, raw_image_blob_name, is_published, moderation_status
      ) VALUES (
        @id, @userId, @title, @description, @instructions, @rawImageBlobName, 0, 'draft'
      )`,
      {
        id: recipeId,
        userId,
        title: input.title,
        description: input.description ?? null,
        instructions: input.instructions ?? null,
        rawImageBlobName: input.rawImageBlobName ?? null
      },
      tx
    );

    if (input.categories) {
      await replaceRecipeCategories(recipeId, input.categories, tx);
    }

    if (input.ingredients) {
      await replaceRecipeIngredients(recipeId, input.ingredients, tx);
    }
  });

  const recipe = await getRecipeById(recipeId);
  if (!recipe) {
    throw new ApiError(500, "Failed to create recipe", "recipe_create_failed");
  }

  return recipe;
}

export async function getRecipeById(recipeId: string): Promise<RecipeDetails | null> {
  const result = await query<Record<string, unknown>>(
    "SELECT * FROM dbo.recipes WHERE id = @id",
    { id: recipeId }
  );

  if (result.recordset.length === 0) {
    return null;
  }

  const recipe = result.recordset[0];
  const categories = await getRecipeCategories(recipeId);
  const ingredients = await getRecipeIngredients(recipeId);

  return {
    ...recipe,
    categories,
    ingredients
  };
}

export async function listRecipes(filters: RecipeListFilters) {
  const where: string[] = ["1=1"];
  const params: Record<string, unknown> = {
    offset: (filters.page - 1) * filters.pageSize,
    pageSize: filters.pageSize
  };

  if (filters.q) {
    where.push("(r.title LIKE @q OR r.description LIKE @q)");
    params.q = `%${filters.q}%`;
  }

  if (filters.isPublished !== null && filters.isPublished !== undefined) {
    where.push("r.is_published = @isPublished");
    params.isPublished = filters.isPublished;
  }

  if (filters.category) {
    where.push(
      "EXISTS (SELECT 1 FROM dbo.recipe_categories rc2 JOIN dbo.categories c2 ON rc2.category_id = c2.id WHERE rc2.recipe_id = r.id AND c2.name = @category)"
    );
    params.category = filters.category;
  }

  const whereClause = where.join(" AND ");

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(DISTINCT r.id) AS total FROM dbo.recipes r WHERE ${whereClause}`,
    params
  );

  const listResult = await query<Record<string, unknown> & { categories?: string }>(
    `SELECT
      r.*, STRING_AGG(c.name, ',') AS categories
     FROM dbo.recipes r
     LEFT JOIN dbo.recipe_categories rc ON r.id = rc.recipe_id
     LEFT JOIN dbo.categories c ON rc.category_id = c.id
     WHERE ${whereClause}
     GROUP BY r.id, r.user_id, r.title, r.description, r.instructions, r.raw_image_blob_name, r.image_url, r.thumb_url, r.is_published, r.moderation_status, r.created_at, r.updated_at
     ORDER BY r.created_at DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    params
  );

  const items = listResult.recordset.map((row) => ({
    ...row,
    categories: row.categories ? row.categories.split(",").map((item) => item.trim()).filter(Boolean) : []
  }));

  return {
    items,
    total: countResult.recordset[0]?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

export async function updateRecipe(recipeId: string, input: RecipeUpdateInput): Promise<RecipeDetails | null> {
  let updated = false;
  let exists = true;

  await withTransaction(async (tx) => {
    const found = await query<{ id: string }>(
      "SELECT id FROM dbo.recipes WHERE id = @id",
      { id: recipeId },
      tx
    );

    if (found.recordset.length === 0) {
      exists = false;
      return;
    }

    const updates: string[] = [];
    const params: Record<string, unknown> = { id: recipeId };

    if (input.title !== undefined) {
      updates.push("title = @title");
      params.title = input.title;
    }

    if (input.description !== undefined) {
      updates.push("description = @description");
      params.description = input.description;
    }

    if (input.instructions !== undefined) {
      updates.push("instructions = @instructions");
      params.instructions = input.instructions;
    }

    if (input.rawImageBlobName !== undefined) {
      updates.push("raw_image_blob_name = @rawImageBlobName");
      params.rawImageBlobName = input.rawImageBlobName;
    }

    if (updates.length > 0) {
      updates.push("updated_at = SYSUTCDATETIME()");
      const updateResult = await query(
        `UPDATE dbo.recipes SET ${updates.join(", ")} WHERE id = @id`,
        params,
        tx
      );
      updated = updateResult.rowsAffected[0] > 0;
    }

    if (input.categories) {
      await replaceRecipeCategories(recipeId, input.categories, tx);
      updated = true;
    }

    if (input.ingredients) {
      await replaceRecipeIngredients(recipeId, input.ingredients, tx);
      updated = true;
    }
  });

  if (!exists) {
    return null;
  }

  if (!updated) {
    const existing = await getRecipeById(recipeId);
    return existing;
  }

  return getRecipeById(recipeId);
}

export async function deleteRecipe(recipeId: string): Promise<Record<string, unknown> | null> {
  let recipe: Record<string, unknown> | null = null;

  await withTransaction(async (tx) => {
    const result = await query<Record<string, unknown>>(
      "SELECT * FROM dbo.recipes WHERE id = @id",
      { id: recipeId },
      tx
    );

    if (result.recordset.length === 0) {
      recipe = null;
      return;
    }

    recipe = result.recordset[0];

    await query("DELETE FROM dbo.recipe_categories WHERE recipe_id = @id", { id: recipeId }, tx);
    await query("DELETE FROM dbo.recipe_ingredients WHERE recipe_id = @id", { id: recipeId }, tx);
    await query("DELETE FROM dbo.reviews WHERE recipe_id = @id", { id: recipeId }, tx);
    await query("DELETE FROM dbo.favorites WHERE recipe_id = @id", { id: recipeId }, tx);
    await query("DELETE FROM dbo.recipes WHERE id = @id", { id: recipeId }, tx);
  });

  return recipe;
}

export async function setPublishStatus(recipeId: string) {
  const result = await query<Record<string, unknown>>(
    "UPDATE dbo.recipes SET is_published = 1, moderation_status = 'pending', updated_at = SYSUTCDATETIME() WHERE id = @id; SELECT * FROM dbo.recipes WHERE id = @id;",
    { id: recipeId }
  );

  return result.recordset[0] ?? null;
}

export async function setModerationStatus(recipeId: string, status: string, isPublished: boolean) {
  const result = await query<Record<string, unknown>>(
    "UPDATE dbo.recipes SET moderation_status = @status, is_published = @isPublished, updated_at = SYSUTCDATETIME() WHERE id = @id; SELECT * FROM dbo.recipes WHERE id = @id;",
    { id: recipeId, status, isPublished }
  );

  return result.recordset[0] ?? null;
}

export async function setRecipeImages(recipeId: string, imageUrl: string, thumbUrl: string) {
  await query(
    "UPDATE dbo.recipes SET image_url = @imageUrl, thumb_url = @thumbUrl, updated_at = SYSUTCDATETIME() WHERE id = @id",
    { id: recipeId, imageUrl, thumbUrl }
  );
}

export async function getRecipeCategories(recipeId: string): Promise<string[]> {
  const result = await query<{ name: string }>(
    "SELECT c.name FROM dbo.categories c JOIN dbo.recipe_categories rc ON rc.category_id = c.id WHERE rc.recipe_id = @id ORDER BY c.name",
    { id: recipeId }
  );
  return result.recordset.map((row) => row.name);
}

export async function getRecipeIngredients(recipeId: string): Promise<IngredientInput[]> {
  const result = await query<{ name: string; quantity: string | null }>(
    "SELECT i.name, ri.quantity FROM dbo.ingredients i JOIN dbo.recipe_ingredients ri ON ri.ingredient_id = i.id WHERE ri.recipe_id = @id ORDER BY i.name",
    { id: recipeId }
  );

  return result.recordset.map((row) => ({
    name: row.name,
    quantity: row.quantity ?? undefined
  }));
}

export async function getRecipeTags(recipeId: string): Promise<string[]> {
  return getRecipeCategories(recipeId);
}

export async function getRatingAvg(recipeId: string): Promise<number> {
  const result = await query<{ ratingAvg: number | null }>(
    "SELECT AVG(CAST(rating AS FLOAT)) AS ratingAvg FROM dbo.reviews WHERE recipe_id = @id",
    { id: recipeId }
  );

  return result.recordset[0]?.ratingAvg ?? 0;
}

export async function ensureUser(
  userId: string | null | undefined,
  userName?: string | null,
  userEmail?: string | null,
  transaction?: sql.Transaction
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const existing = await query<{ id: string }>(
    "SELECT id FROM dbo.users WHERE id = @id",
    { id: userId },
    transaction
  );

  if (existing.recordset.length > 0) {
    return userId;
  }

  await query(
    "INSERT INTO dbo.users (id, name, email) VALUES (@id, @name, @email)",
    {
      id: userId,
      name: userName ?? "anonymous",
      email: userEmail ?? null
    },
    transaction
  );

  return userId;
}

export async function addFavorite(recipeId: string, userId: string, userName?: string | null) {
  await withTransaction(async (tx) => {
    await ensureUser(userId, userName ?? null, null, tx);

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.favorites WHERE user_id = @userId AND recipe_id = @recipeId)
       INSERT INTO dbo.favorites (id, user_id, recipe_id) VALUES (@id, @userId, @recipeId)`,
      {
        id: uuidv4(),
        userId,
        recipeId
      },
      tx
    );
  });
}

export async function removeFavorite(recipeId: string, userId: string) {
  await query("DELETE FROM dbo.favorites WHERE user_id = @userId AND recipe_id = @recipeId", {
    userId,
    recipeId
  });
}

async function replaceRecipeCategories(
  recipeId: string,
  categories: string[],
  transaction: sql.Transaction
) {
  await query("DELETE FROM dbo.recipe_categories WHERE recipe_id = @id", { id: recipeId }, transaction);

  for (const name of categories.map((item) => item.trim()).filter(Boolean)) {
    let categoryId: string;

    const existing = await query<{ id: string }>(
      "SELECT id FROM dbo.categories WHERE name = @name",
      { name },
      transaction
    );

    if (existing.recordset.length > 0) {
      categoryId = existing.recordset[0].id;
    } else {
      categoryId = uuidv4();
      await query(
        "INSERT INTO dbo.categories (id, name) VALUES (@id, @name)",
        { id: categoryId, name },
        transaction
      );
    }

    await query(
      "INSERT INTO dbo.recipe_categories (id, recipe_id, category_id) VALUES (@id, @recipeId, @categoryId)",
      { id: uuidv4(), recipeId, categoryId },
      transaction
    );
  }
}

async function replaceRecipeIngredients(
  recipeId: string,
  ingredients: IngredientInput[],
  transaction: sql.Transaction
) {
  await query("DELETE FROM dbo.recipe_ingredients WHERE recipe_id = @id", { id: recipeId }, transaction);

  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();
    if (!name) {
      continue;
    }

    let ingredientId: string;
    const existing = await query<{ id: string }>(
      "SELECT id FROM dbo.ingredients WHERE name = @name",
      { name },
      transaction
    );

    if (existing.recordset.length > 0) {
      ingredientId = existing.recordset[0].id;
    } else {
      ingredientId = uuidv4();
      await query(
        "INSERT INTO dbo.ingredients (id, name) VALUES (@id, @name)",
        { id: ingredientId, name },
        transaction
      );
    }

    await query(
      "INSERT INTO dbo.recipe_ingredients (id, recipe_id, ingredient_id, quantity) VALUES (@id, @recipeId, @ingredientId, @quantity)",
      {
        id: uuidv4(),
        recipeId,
        ingredientId,
        quantity: ingredient.quantity ?? null
      },
      transaction
    );
  }
}
