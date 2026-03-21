import { NextResponse } from 'next/server';
import { getAllTags, createTag, tagExistsByName } from '@/lib/db/queries/tags';
import { requireAuthOrApiKey } from '@/lib/auth/session';
import type { TagInput } from '@/lib/types/recipe';

const VALID_COLORS = [
  'gray', 'red', 'orange', 'amber', 'yellow',
  'green', 'emerald', 'cyan', 'blue', 'purple', 'pink'
];

export async function GET(request: Request) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const tags = await getAllTags();
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Tags konnten nicht geladen werden' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const body: TagInput = await request.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: 'Name ist erforderlich' },
        { status: 400 }
      );
    }

    if (!body.color || !VALID_COLORS.includes(body.color)) {
      return NextResponse.json(
        { error: 'Ungültige Farbe' },
        { status: 400 }
      );
    }

    // Check if tag name already exists
    const exists = await tagExistsByName(body.name);
    if (exists) {
      return NextResponse.json(
        { error: 'Ein Tag mit diesem Namen existiert bereits' },
        { status: 400 }
      );
    }

    const tag = await createTag({
      name: body.name.trim(),
      color: body.color,
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Tag konnte nicht erstellt werden' },
      { status: 500 }
    );
  }
}
