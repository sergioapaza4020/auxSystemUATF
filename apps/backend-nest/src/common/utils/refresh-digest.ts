import { createHash, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcrypt';

export const refreshDigest = (token: string) =>
  `sha256:v1:${createHash('sha256').update(token).digest('hex')}`;

export async function matchesRefresh(token: string, stored: string): Promise<boolean> {
  if (stored.startsWith('sha256:v1:')) {
    const actual = Buffer.from(refreshDigest(token));
    const expected = Buffer.from(stored);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  return /^\$2[aby]\$/.test(stored) && bcrypt.compare(token, stored);
}
