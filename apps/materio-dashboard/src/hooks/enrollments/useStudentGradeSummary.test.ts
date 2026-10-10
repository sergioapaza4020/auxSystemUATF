import * as React from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getStudentGradeSummary } from '@/api/enrollments.service';
import { useStudentGradeSummary } from './useStudentGradeSummary';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(), useEffect: vi.fn() };
});
vi.mock('@/api/enrollments.service', () => ({ getStudentGradeSummary: vi.fn() }));
afterEach(() => vi.clearAllMocks());

function useMount(id: number | null) {
  const effects: (() => void | (() => void))[] = [];

  vi.mocked(React.useEffect).mockImplementation((effect) => {
    effects.push(effect);
  });
  vi.mocked(React.useState).mockImplementation(((initial?: unknown) => [initial, vi.fn()]) as typeof React.useState);
  useStudentGradeSummary(id, null);

  return effects[0]();
}

describe('Aggregated grade loading', () => {
  it('makes one aggregated request independent of student count, with no enrollment grade loop', async () => {
    vi.mocked(getStudentGradeSummary).mockResolvedValue({
      scheme: null,
      students: Array.from({ length: 150 }, (_, index) => ({
        idEnrollment: index,
        details: [],
        totalRaw: null,
        assistantContribution: null,
      })),
    });
    const cleanup = useMount(7);

    await Promise.resolve();
    expect(getStudentGradeSummary).toHaveBeenCalledTimes(1);
    expect(getStudentGradeSummary).toHaveBeenCalledWith(7, expect.any(AbortSignal));
    if (cleanup) cleanup();
    expect(vi.mocked(getStudentGradeSummary).mock.calls[0][1]?.aborted).toBe(true);
  });
  it('does not request grades when permission or assistant enrollment is absent', () => {
    vi.mocked(getStudentGradeSummary).mockClear();
    useMount(null);
    expect(getStudentGradeSummary).not.toHaveBeenCalled();
  });
});
