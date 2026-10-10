import { describe, expect, it } from 'vitest';

import { readGradeDraftSession, serializeGradeDraftSession } from './grade-draft-session';

describe('Draft protection for browser history navigation', () => {
  it('restores pending cells and their original values without turning missing scores into zero', () => {
    const value = serializeGradeDraftSession(
      { '100:10': 80, '100:11': null, '100:12': 50 },
      { '100:10': '85', '100:11': '0', '100:12': '50' },
    );

    expect(readGradeDraftSession(value)).toEqual({
      originals: { '100:10': 80, '100:11': null },
      drafts: { '100:10': '85', '100:11': '0' },
    });
    expect(serializeGradeDraftSession({ '100:10': 85 }, {})).toBeNull();
  });
  it('retains invalid pending inputs and rejects malformed session data', () => {
    expect(
      readGradeDraftSession(serializeGradeDraftSession({ '100:10': null }, { '100:10': '101' })).drafts['100:10'],
    ).toBe('101');
    for (const invalid of [
      null,
      'broken',
      '{}',
      '{"drafts":null,"originals":{}}',
      '{"drafts":{"bad":"90"},"originals":{"bad":0}}',
    ])
      expect(readGradeDraftSession(invalid)).toEqual({ originals: {}, drafts: {} });
  });
});
