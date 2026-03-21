import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getSetting, setSetting } from '@/lib/db/queries/settings';
import { generateApiKey, hashApiKey, parseApiKeys, serializeApiKeys } from '@/lib/auth/api-key';

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const raw = await getSetting('api_keys');
    const keys = parseApiKeys(raw);
    return NextResponse.json(
      keys.map((k, i) => ({ id: i, name: k.name, prefix: k.prefix }))
    );
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const key = generateApiKey();
    const hash = await hashApiKey(key);
    const prefix = key.slice(0, 11); // "rz_" + first 8 hex chars

    const raw = await getSetting('api_keys');
    const keys = parseApiKeys(raw);
    keys.push({ name: name.trim(), prefix, hash });
    await setSetting('api_keys', serializeApiKeys(keys));

    return NextResponse.json({ key, name: name.trim(), prefix }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
