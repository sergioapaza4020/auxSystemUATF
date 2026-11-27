import * as bcrypt from 'bcrypt';
import { matchesRefresh, refreshDigest } from './refresh-digest';

describe('refresh digest', () => {
  it('uses a versioned SHA-256 digest of the complete token', async () => {
    const token = `${'x'.repeat(200)}-one`;
    const other = `${'x'.repeat(200)}-two`;
    const stored = refreshDigest(token);
    expect(stored).toMatch(/^sha256:v1:[a-f0-9]{64}$/);
    expect(await matchesRefresh(token, stored)).toBe(true);
    expect(await matchesRefresh(other, stored)).toBe(false);
  });

  it('continues to validate legacy bcrypt hashes', async () => {
    const token = 'historical-refresh-token';
    const stored = await bcrypt.hash(token, 4);
    expect(await matchesRefresh(token, stored)).toBe(true);
    expect(await matchesRefresh('different-token', stored)).toBe(false);
  });
});
