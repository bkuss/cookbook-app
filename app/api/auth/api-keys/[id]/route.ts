import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getSetting, setSetting } from '@/lib/db/queries/settings';
import { parseApiKeys, serializeApiKeys } from '@/lib/auth/api-key';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const index = parseInt(id, 10);

    const raw = await getSetting('api_keys');
    const keys = parseApiKeys(raw);

    if (isNaN(index) || index < 0 || index >= keys.length) {
      return NextResponse.json({ error: 'Schlüssel nicht gefunden' }, { status: 404 });
    }

    keys.splice(index, 1);
    await setSetting('api_keys', serializeApiKeys(keys));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
