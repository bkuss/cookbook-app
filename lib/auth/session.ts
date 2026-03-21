import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db/queries/settings';
import { parseApiKeys, verifyApiKeyHash } from '@/lib/auth/api-key';

function getSecret() {
  const secretKey = process.env.SESSION_SECRET;
  if (!secretKey) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secretKey);
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());

  return token;
}

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return false;

  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false';
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function requireAuth(): Promise<NextResponse | null> {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  return null;
}

export async function requireAuthOrApiKey(request: Request): Promise<NextResponse | null> {
  const isAuthenticated = await verifySession();
  if (isAuthenticated) return null;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7);
    const raw = await getSetting('api_keys');
    const keys = parseApiKeys(raw);
    for (const stored of keys) {
      if (await verifyApiKeyHash(key, stored.hash)) {
        return null;
      }
    }
  }

  return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
}
