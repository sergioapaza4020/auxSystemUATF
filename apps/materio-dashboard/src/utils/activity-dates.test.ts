import { describe, expect, it } from 'vitest';

import { formatActivityPublication } from './activity-dates';

describe('Academic publication dates', () => {
  it('uses La Paz instead of the browser timezone across midnight', () => {
    expect(formatActivityPublication('2026-10-06T03:59:59Z')).toBe('2026-10-05');
    expect(formatActivityPublication('2026-10-06T04:00:00Z')).toBe('2026-10-06');
  });
});
