import type { Ingredient, RecipeInput } from '@/lib/types/recipe';
import Replicate from 'replicate';
import { IMAGE_RECIPE_PROMPT, URL_RECIPE_PROMPT, RECIPE_REFINEMENT_PROMPT } from './prompts';
import { isValidAmount } from '@/lib/utils/amount';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface ExtractedRecipe {
  title: string;
  servings: number;
  ingredients: { name: string; amount: string | number | null; unit: string | null }[];
  instructions: string;
}

function parseRecipeResponse(output: unknown): RecipeInput {
  let jsonStr: string;

  if (typeof output === 'string') {
    jsonStr = output;
  } else if (Array.isArray(output)) {
    jsonStr = output.join('');
  } else {
    throw new Error('Unexpected output format from model');
  }

  // Try to extract JSON from the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  let parsed: ExtractedRecipe;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse JSON from response');
  }

  // Validate required fields
  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Missing or invalid title');
  }

  if (!parsed.instructions || typeof parsed.instructions !== 'string') {
    throw new Error('Missing or invalid instructions');
  }

  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
    throw new Error('Missing or invalid ingredients');
  }

  // Transform to RecipeInput format
  const ingredients: Omit<Ingredient, 'id' | 'sortOrder'>[] = parsed.ingredients
    .filter((ing) => ing.name && typeof ing.name === 'string')
    .map((ing) => {
      let amount: string | null = null;

      if (typeof ing.amount === 'number') {
        // Convert number to string (for backward compatibility with LLMs returning numbers)
        amount = Number.isInteger(ing.amount)
          ? ing.amount.toString()
          : ing.amount.toString().replace(/\.?0+$/, '');
      } else if (typeof ing.amount === 'string' && isValidAmount(ing.amount)) {
        amount = ing.amount.trim();
      }

      return {
        name: ing.name.trim(),
        amount,
        unit: ing.unit && typeof ing.unit === 'string' ? ing.unit.trim() : null,
      };
    });

  return {
    title: parsed.title.trim(),
    instructions: parsed.instructions.trim(),
    servings: typeof parsed.servings === 'number' ? parsed.servings : 4,
    ingredients,
  };
}

import { getSetting } from '../db/queries/settings';

// ... existing code ...

export async function extractRecipeFromImage(imageBase64: string, strict: boolean = false): Promise<RecipeInput> {
  const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const model = await getSetting('recipe_model') || 'openai/gpt-5.4';

  // Define input based on model
  const input: Record<string, unknown> = {
    prompt: IMAGE_RECIPE_PROMPT(strict),
  };

  if (model === 'openai/gpt-5.4') {
    // gpt-5.4 uses image_input array
    input.image_input = [imageUrl];
    input.reasoning_effort = 'low';
  } else if (model === 'anthropic/claude-4.5-sonnet') {
    // Claude uses 'image' (string) and max_tokens
    input.image = imageUrl;
    input.max_tokens = 2048;
  } else if (model === 'google/gemini-3-pro') {
    // Gemini expects 'images' (array)
    input.images = [imageUrl];
  } else if (model === 'google/gemini-2.5-flash') {
    input.images = [imageUrl];
  } else {
    // Fallback: try image_input (most common format)
    input.image_input = [imageUrl];
  }

  const output = await replicate.run(model as `${string}/${string}`, { input });

  return parseRecipeResponse(output);
}

export async function extractRecipeFromText(content: string, strict: boolean = false): Promise<RecipeInput> {
  // Truncate content if too long
  const truncatedContent = content.length > 10000 ? content.substring(0, 10000) : content;

  const model = await getSetting('recipe_model') || 'openai/gpt-5.4';

  const input: Record<string, unknown> = {
    prompt: `${URL_RECIPE_PROMPT(strict)}\n\n${truncatedContent}`,
  };

  if (model === 'openai/gpt-5.4') {
    input.reasoning_effort = 'low';
  } else if (model === 'anthropic/claude-4.5-sonnet') {
    input.max_tokens = 2048;
  }
  // google/gemini-3-pro and google/gemini-2.5-flash use defaults

  const output = await replicate.run(model as `${string}/${string}`, { input });

  return parseRecipeResponse(output);
}

const DEFAULT_IMAGE_PROMPT_TEMPLATE = 'Professional food photography of "{title}" dish with {ingredients}, appetizing, well-plated on a wooden surface, some of the ingredients visible behind and around the dish, natural lighting, shallow depth of field, isometric view';

export async function generateRecipeImage(title: string, ingredients: string[]): Promise<Buffer> {
  const ingredientsList = ingredients.slice(0, 12).join(', ');
  const template = await getSetting('image_prompt_template') || DEFAULT_IMAGE_PROMPT_TEMPLATE;
  const prompt = template.replace('{title}', title).replace('{ingredients}', ingredientsList);

  const imageModel = await getSetting('image_model') || 'google/nano-banana';

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: '16:9',
  };

  if (imageModel === 'google/nano-banana-pro') {
    input.resolution = '1K';
    input.output_format = 'jpg';
  } else if (imageModel === 'black-forest-labs/flux-schnell') {
    input.output_format = 'webp';
  } else if (imageModel === 'ideogram-ai/ideogram-v3-turbo') {
    input.style_type = 'Realistic';
  } else if (imageModel === 'openai/gpt-image-1.5') {
    input.aspect_ratio = '3:2';
    input.quality = 'medium';
    input.output_format = 'webp';
  }

  const rawOutput = await replicate.run(imageModel as `${string}/${string}`, { input });

  // Many models return an array of outputs - take the first one
  const output = Array.isArray(rawOutput) && rawOutput.length > 0 ? rawOutput[0] : rawOutput;

  // Output is a FileOutput object - can be used directly as a Buffer
  if (output instanceof Buffer) {
    return output;
  }

  // If it's a string URL, fetch it
  if (typeof output === 'string' && output.startsWith('http')) {
    const response = await fetch(output);
    if (!response.ok) {
      throw new Error('Failed to fetch generated image');
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // If it's a FileOutput with url() method
  if (output && typeof output === 'object' && typeof (output as { url?: () => string }).url === 'function') {
    const url = (output as { url: () => string }).url();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch generated image');
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error('Unexpected output format from image generation model');
}

export interface RefineRecipeInput {
  title: string;
  servings: number;
  ingredients: { name: string; amount: string | null; unit: string | null }[];
  instructions: string;
}

export async function refineRecipe(recipe: RefineRecipeInput, userRequest: string): Promise<RecipeInput> {
  const recipeJson = JSON.stringify({
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  }, null, 2);

  const prompt = `${RECIPE_REFINEMENT_PROMPT}

Aktuelles Rezept:
${recipeJson}

Benutzeranweisung:
${userRequest}`;

  const model = await getSetting('recipe_model') || 'openai/gpt-5.4';

  const input: Record<string, unknown> = {
    prompt,
  };

  if (model === 'openai/gpt-5.4') {
    input.reasoning_effort = 'low';
  } else if (model === 'anthropic/claude-4.5-sonnet') {
    input.max_tokens = 2048;
  }

  const output = await replicate.run(model as `${string}/${string}`, { input });

  return parseRecipeResponse(output);
}
