import { NextResponse } from 'next/server';
import { getAllRecipes, createRecipe } from '@/lib/db/queries/recipes';
import { requireAuthOrApiKey } from '@/lib/auth/session';
import type { RecipeInput } from '@/lib/types/recipe';

export async function GET(request: Request) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || undefined;
    const tagsParam = searchParams.get('tags');
    const tagIds = tagsParam
      ? tagsParam.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
      : undefined;

    const recipes = await getAllRecipes(query, tagIds);

    const includeImageData = searchParams.get('includeImageData') === 'true';
    if (!includeImageData && request.headers.get('authorization')?.startsWith('Bearer ')) {
      return NextResponse.json(recipes.map(({ imageData: _, ...rest }) => rest));
    }

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Rezepte konnten nicht geladen werden' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const body: RecipeInput = await request.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: 'Titel ist erforderlich' },
        { status: 400 }
      );
    }

    if (!body.instructions || !body.instructions.trim()) {
      return NextResponse.json(
        { error: 'Anleitung ist erforderlich' },
        { status: 400 }
      );
    }

    if (!body.ingredients || body.ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Mindestens eine Zutat ist erforderlich' },
        { status: 400 }
      );
    }

    const recipe = await createRecipe({
      title: body.title.trim(),
      instructions: body.instructions.trim(),
      servings: body.servings || 4,
      imageData: body.imageData || null,
      sourceUrl: body.sourceUrl || null,
      ingredients: body.ingredients.filter((ing) => ing.name && ing.name.trim()),
      tagIds: body.tagIds || [],
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { error: 'Rezept konnte nicht erstellt werden' },
      { status: 500 }
    );
  }
}
