import { query, getClient } from '../connection';
import type { Recipe, RecipeInput, RecipeListItem, Ingredient, Tag, TagColor } from '@/lib/types/recipe';

interface RecipeRow {
  id: string;
  title: string;
  instructions: string;
  servings: number;
  image_data: string | null;
  source_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface IngredientRow {
  id: number;
  recipe_id: string;
  name: string;
  amount: string | null;
  unit: string | null;
  sort_order: number;
}

interface TagRow {
  id: number;
  name: string;
  color: string;
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color as TagColor,
  };
}

async function getTagsForRecipe(recipeId: string): Promise<Tag[]> {
  const result = await query<TagRow>(
    `SELECT t.id, t.name, t.color
     FROM recipes_tags t
     INNER JOIN recipes_recipe_tags rt ON t.id = rt.tag_id
     WHERE rt.recipe_id = $1
     ORDER BY t.name`,
    [recipeId]
  );
  return result.rows.map(rowToTag);
}

async function getTagsForRecipes(recipeIds: string[]): Promise<Map<string, Tag[]>> {
  if (recipeIds.length === 0) {
    return new Map();
  }

  const placeholders = recipeIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<TagRow & { recipe_id: string }>(
    `SELECT t.id, t.name, t.color, rt.recipe_id
     FROM recipes_tags t
     INNER JOIN recipes_recipe_tags rt ON t.id = rt.tag_id
     WHERE rt.recipe_id IN (${placeholders})
     ORDER BY t.name`,
    recipeIds
  );

  const tagsByRecipe = new Map<string, Tag[]>();
  for (const row of result.rows) {
    const tags = tagsByRecipe.get(row.recipe_id) || [];
    tags.push(rowToTag(row));
    tagsByRecipe.set(row.recipe_id, tags);
  }

  return tagsByRecipe;
}

export async function getAllRecipes(searchQuery?: string, tagIds?: number[]): Promise<RecipeListItem[]> {
  let sql = `
    SELECT DISTINCT r.id, r.title, r.image_data, r.servings, r.created_at
    FROM recipes_recipes r
  `;
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (tagIds && tagIds.length > 0) {
    // Filter for recipes that have ANY of the selected tags
    sql += ` INNER JOIN recipes_recipe_tags rt ON r.id = rt.recipe_id`;
    const placeholders = tagIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
    conditions.push(`rt.tag_id IN (${placeholders})`);
    params.push(...tagIds);
  }

  if (searchQuery && searchQuery.trim()) {
    conditions.push(
      `(to_tsvector('german', r.title) @@ plainto_tsquery('german', $${params.length + 1})
       OR r.title ILIKE $${params.length + 2})`
    );
    params.push(searchQuery.trim(), `%${searchQuery.trim()}%`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` ORDER BY r.created_at DESC`;

  const result = await query<RecipeRow>(sql, params);

  const recipeIds = result.rows.map((r) => r.id);
  const tagsByRecipe = await getTagsForRecipes(recipeIds);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    imageData: row.image_data,
    servings: row.servings,
    tags: tagsByRecipe.get(row.id) || [],
    createdAt: row.created_at,
  }));
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const recipeResult = await query<RecipeRow>(
    `SELECT id, title, instructions, servings, image_data, source_url, created_at, updated_at
     FROM recipes_recipes WHERE id = $1`,
    [id]
  );

  if (recipeResult.rows.length === 0) {
    return null;
  }

  const row = recipeResult.rows[0];

  const ingredientsResult = await query<IngredientRow>(
    `SELECT id, recipe_id, name, amount, unit, sort_order
     FROM recipes_ingredients WHERE recipe_id = $1 ORDER BY sort_order`,
    [id]
  );

  const ingredients: Ingredient[] = ingredientsResult.rows.map((ing) => ({
    id: ing.id,
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    sortOrder: ing.sort_order,
  }));

  const tags = await getTagsForRecipe(id);

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    servings: row.servings,
    imageData: row.image_data,
    sourceUrl: row.source_url,
    ingredients,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const recipeResult = await client.query<RecipeRow>(
      `INSERT INTO recipes_recipes (title, instructions, servings, image_data, source_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, instructions, servings, image_data, source_url, created_at, updated_at`,
      [input.title, input.instructions, input.servings, input.imageData || null, input.sourceUrl || null]
    );

    const recipe = recipeResult.rows[0];

    const ingredients: Ingredient[] = [];
    for (let i = 0; i < input.ingredients.length; i++) {
      const ing = input.ingredients[i];
      const ingResult = await client.query<IngredientRow>(
        `INSERT INTO recipes_ingredients (recipe_id, name, amount, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, recipe_id, name, amount, unit, sort_order`,
        [recipe.id, ing.name, ing.amount, ing.unit, i]
      );
      const row = ingResult.rows[0];
      ingredients.push({
        id: row.id,
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        sortOrder: row.sort_order,
      });
    }

    // Insert tags
    const tags: Tag[] = [];
    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await client.query(
          `INSERT INTO recipes_recipe_tags (recipe_id, tag_id) VALUES ($1, $2)`,
          [recipe.id, tagId]
        );
      }
      // Fetch the tags to return
      const tagsResult = await client.query<TagRow>(
        `SELECT t.id, t.name, t.color
         FROM recipes_tags t
         INNER JOIN recipes_recipe_tags rt ON t.id = rt.tag_id
         WHERE rt.recipe_id = $1
         ORDER BY t.name`,
        [recipe.id]
      );
      tags.push(...tagsResult.rows.map(rowToTag));
    }

    await client.query('COMMIT');

    return {
      id: recipe.id,
      title: recipe.title,
      instructions: recipe.instructions,
      servings: recipe.servings,
      imageData: recipe.image_data,
      sourceUrl: recipe.source_url,
      ingredients,
      tags,
      createdAt: recipe.created_at,
      updatedAt: recipe.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface UpdateRecipeOptions {
  keepExistingImage?: boolean;
}

export async function updateRecipe(id: string, input: RecipeInput, options?: UpdateRecipeOptions): Promise<Recipe | null> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const recipeResult = await client.query<RecipeRow>(
      `UPDATE recipes_recipes
       SET title = $1, instructions = $2, servings = $3,
           image_data = CASE WHEN $7::boolean THEN image_data ELSE $4 END,
           source_url = $5
       WHERE id = $6
       RETURNING id, title, instructions, servings, image_data, source_url, created_at, updated_at`,
      [input.title, input.instructions, input.servings, input.imageData || null, input.sourceUrl || null, id, options?.keepExistingImage ?? false]
    );

    if (recipeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const recipe = recipeResult.rows[0];

    // Delete existing ingredients and re-insert
    await client.query('DELETE FROM recipes_ingredients WHERE recipe_id = $1', [id]);

    const ingredients: Ingredient[] = [];
    for (let i = 0; i < input.ingredients.length; i++) {
      const ing = input.ingredients[i];
      const ingResult = await client.query<IngredientRow>(
        `INSERT INTO recipes_ingredients (recipe_id, name, amount, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, recipe_id, name, amount, unit, sort_order`,
        [recipe.id, ing.name, ing.amount, ing.unit, i]
      );
      const row = ingResult.rows[0];
      ingredients.push({
        id: row.id,
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        sortOrder: row.sort_order,
      });
    }

    // Delete existing tags and re-insert
    await client.query('DELETE FROM recipes_recipe_tags WHERE recipe_id = $1', [id]);

    const tags: Tag[] = [];
    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await client.query(
          `INSERT INTO recipes_recipe_tags (recipe_id, tag_id) VALUES ($1, $2)`,
          [recipe.id, tagId]
        );
      }
      // Fetch the tags to return
      const tagsResult = await client.query<TagRow>(
        `SELECT t.id, t.name, t.color
         FROM recipes_tags t
         INNER JOIN recipes_recipe_tags rt ON t.id = rt.tag_id
         WHERE rt.recipe_id = $1
         ORDER BY t.name`,
        [recipe.id]
      );
      tags.push(...tagsResult.rows.map(rowToTag));
    }

    await client.query('COMMIT');

    return {
      id: recipe.id,
      title: recipe.title,
      instructions: recipe.instructions,
      servings: recipe.servings,
      imageData: recipe.image_data,
      sourceUrl: recipe.source_url,
      ingredients,
      tags,
      createdAt: recipe.created_at,
      updatedAt: recipe.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const result = await query('DELETE FROM recipes_recipes WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getAllRecipesWithIngredients(): Promise<Recipe[]> {
  const recipesResult = await query<RecipeRow>(
    `SELECT id, title, instructions, servings, image_data, source_url, created_at, updated_at
     FROM recipes_recipes ORDER BY created_at DESC`
  );

  const recipeIds = recipesResult.rows.map((r) => r.id);
  const tagsByRecipe = await getTagsForRecipes(recipeIds);

  const recipes: Recipe[] = [];

  for (const row of recipesResult.rows) {
    const ingredientsResult = await query<IngredientRow>(
      `SELECT id, recipe_id, name, amount, unit, sort_order
       FROM recipes_ingredients WHERE recipe_id = $1 ORDER BY sort_order`,
      [row.id]
    );

    const ingredients: Ingredient[] = ingredientsResult.rows.map((ing) => ({
      id: ing.id,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      sortOrder: ing.sort_order,
    }));

    recipes.push({
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      servings: row.servings,
      imageData: row.image_data,
      sourceUrl: row.source_url,
      ingredients,
      tags: tagsByRecipe.get(row.id) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return recipes;
}

export async function recipeExistsByTitle(title: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM recipes_recipes WHERE LOWER(title) = LOWER($1)) as exists`,
    [title]
  );
  return result.rows[0].exists;
}
