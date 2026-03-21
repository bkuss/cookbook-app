import { NextResponse } from 'next/server';
import { getRecipeById, updateRecipe, deleteRecipe } from '@/lib/db/queries/recipes';
import { requireAuthOrApiKey } from '@/lib/auth/session';
import type { RecipeInput } from '@/lib/types/recipe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const recipe = await getRecipeById(id);

    if (!recipe) {
      return NextResponse.json(
        { error: 'Rezept nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Rezept konnte nicht geladen werden' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
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

    const recipe = await updateRecipe(id, {
      title: body.title.trim(),
      instructions: body.instructions.trim(),
      servings: body.servings || 4,
      imageData: body.imageData || null,
      sourceUrl: body.sourceUrl || null,
      ingredients: body.ingredients.filter((ing) => ing.name && ing.name.trim()),
      tagIds: body.tagIds || [],
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Rezept nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json(
      { error: 'Rezept konnte nicht aktualisiert werden' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const deleted = await deleteRecipe(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Rezept nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json(
      { error: 'Rezept konnte nicht gelöscht werden' },
      { status: 500 }
    );
  }
}
