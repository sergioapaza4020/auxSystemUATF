import { describe, expect, it } from 'vitest';

import { parsePermissionPercentage, permissionWeightToPercentage } from './attendance-permission';

describe('Permission percentage UI conversion', () => {
  it.each([0, 10, 25, 33.3, 33.33, 50, 50.5, 62.5, 75, 99, 100])('normalizes and displays %s%%', (percentage) => {
    const weight = parsePermissionPercentage(String(percentage));

    expect(weight).toBeCloseTo(percentage / 100, 12);
    expect(permissionWeightToPercentage(weight)).toBe(percentage);
  });
  it('sends a stable normalized decimal for 33.3%', () => {
    expect(parsePermissionPercentage('33.3')).toBe(0.333);
  });
  it.each(['', ' ', '-1', '101', 'NaN', 'Infinity', '-Infinity', 'invalid', '50%', '0x32', '1e309'])(
    'rejects invalid input %s',
    (input) => {
      expect(Number.isNaN(parsePermissionPercentage(input))).toBe(true);
    },
  );
});
