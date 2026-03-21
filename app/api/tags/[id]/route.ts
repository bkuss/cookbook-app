import { NextResponse } from 'next/server';
import { getTagById, updateTag, deleteTag, tagExistsByName, getTagUsageCount } from '@/lib/db/queries/tags';
import { requireAuthOrApiKey } from '@/lib/auth/session';
import type { TagInput } from '@/lib/types/recipe';

const VALID_COLORS = [
  'gray', 'red', 'orange', 'amber', 'yellow',
  'green', 'emerald', 'cyan', 'blue', 'purple', 'pink'
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Ungültige Tag-ID' },
        { status: 400 }
      );
    }

    const tag = await getTagById(tagId);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag nicht gefunden' },
        { status: 404 }
      );
    }

    // Include usage count
    const usageCount = await getTagUsageCount(tagId);

    return NextResponse.json({ ...tag, usageCount });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: 'Tag konnte nicht geladen werden' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Ungültige Tag-ID' },
        { status: 400 }
      );
    }

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

    // Check if tag name already exists (excluding current tag)
    const exists = await tagExistsByName(body.name, tagId);
    if (exists) {
      return NextResponse.json(
        { error: 'Ein Tag mit diesem Namen existiert bereits' },
        { status: 400 }
      );
    }

    const tag = await updateTag(tagId, {
      name: body.name.trim(),
      color: body.color,
    });

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Tag konnte nicht aktualisiert werden' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authError = await requireAuthOrApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Ungültige Tag-ID' },
        { status: 400 }
      );
    }

    const deleted = await deleteTag(tagId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Tag nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Tag konnte nicht gelöscht werden' },
      { status: 500 }
    );
  }
}
