import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface StoredApiKey {
  name: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): string {
  return 'rz_' + randomBytes(16).toString('hex');
}

export async function hashApiKey(key: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(key, salt, 64)) as Buffer;
  return salt + ':' + derivedKey.toString('hex');
}

export async function verifyApiKeyHash(key: string, hash: string): Promise<boolean> {
  const [salt, storedKey] = hash.split(':');
  if (!salt || !storedKey) return false;

  const keyBuffer = Buffer.from(storedKey, 'hex');
  const derivedKey = (await scryptAsync(key, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export function parseApiKeys(raw: string | null): StoredApiKey[] {
  if (!raw) return [];
  return raw.split('||').filter(Boolean).map((entry) => {
    const [name, prefix, hash] = entry.split('::');
    return { name, prefix, hash };
  });
}

export function serializeApiKeys(keys: StoredApiKey[]): string {
  return keys.map((k) => `${k.name}::${k.prefix}::${k.hash}`).join('||');
}
