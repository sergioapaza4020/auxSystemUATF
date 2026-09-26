import { describe, expect, it } from 'vitest';

import { permissionKeyError, permissionPrefix } from './permission-rules';

describe('Permission keys', () => {
  it.each(['user.get-all', 'role.update', 'enrollment.get-one-by-id', 'attendance.session.update'])(
    'accepts controller-style key %s',
    (key) => {
      expect(permissionKeyError(key, [])).toBe('');
      expect(permissionPrefix(key)).toBe(key.split('.')[0]);
    },
  );

  it.each(['user update', 'USER.UPDATE', 'user.*', '', 'user..update'])('rejects ambiguous key %s', (key) => {
    expect(permissionKeyError(key, [])).not.toBe('');
  });

  it('detects inactive duplicates and groups legacy keys without a dot', () => {
    expect(permissionKeyError('user.update', [{ idPermission: 1, name: 'user.update', isActive: false }])).toContain(
      'reactivarla',
    );
    expect(permissionPrefix('legacy')).toBe('(sin prefijo)');
  });
});
