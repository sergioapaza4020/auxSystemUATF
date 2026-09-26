import { describe, expect, it } from 'vitest';

import { hasPermission } from './hasPermission';

describe('UI permission checks', () => {
  it('allows SUPERADMIN with no assigned permissions, including when it is not the first role', () => {
    const user = { roles: ['ADMIN', 'SUPERADMIN'], permissions: [] };

    expect(hasPermission(user, 'semester.get-all')).toBe(true);
    expect(hasPermission(user, 'grade-item.create')).toBe(true);
    expect(user.permissions).toEqual([]);
  });

  it('requires the exact assigned permission for other roles', () => {
    const user = { roles: ['ADMIN'], permissions: ['semester.get-all'] };

    expect(hasPermission(user, 'semester.get-all')).toBe(true);
    expect(hasPermission(user, 'semester.create')).toBe(false);
    expect(hasPermission(user, 'grade-item.get-all')).toBe(false);
    expect(hasPermission({ roles: ['superadmin'], permissions: [] }, 'semester.get-all')).toBe(false);
  });

  it('denies access without a session or assigned permissions', () => {
    expect(hasPermission(null, 'semester.get-all')).toBe(false);
    expect(hasPermission(undefined, 'semester.get-all')).toBe(false);
    expect(hasPermission({ roles: [], permissions: [] }, 'semester.get-all')).toBe(false);
  });
});
