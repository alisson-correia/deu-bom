import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

export function seal(value: string, key: string): string {
  const bytes = Buffer.from(key, 'hex');
  if (bytes.length !== 32) throw new Error('Invalid encryption configuration');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', bytes, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function unseal(value: string, key: string): string {
  const bytes = Buffer.from(key, 'hex'), payload = Buffer.from(value, 'base64url');
  if (bytes.length !== 32 || payload.length < 29) throw new Error('Invalid encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', bytes, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}

export function constantEqual(a: string, b: string) {
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
