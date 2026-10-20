import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCareerById } from '@/api/careers.service';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import type { ICareer } from '@/interfaces/careers/career.interface';
import { useCareerStudentImportContext } from './useCareerStudentImportContext';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/careers.service', () => ({ getCareerById: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe('Single-career context', () => {
  it('reads one ID and cancels an obsolete response on route change', async () => {
    const old = deferred<ICareer | null>();

    vi.mocked(getCareerById)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ idCareer: 8, name: 'Actual', isActive: true });
    let id = 7;
    const h = hookHarness(() => useCareerStudentImportContext(id, true));

    h.render();
    const oldSignal = vi.mocked(getCareerById).mock.calls[0][1];

    id = 8;
    h.render();
    await Promise.resolve();
    await Promise.resolve();
    old.resolve({ idCareer: 7, name: 'Anterior', isActive: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.render().career?.idCareer).toBe(8);
    expect(oldSignal?.aborted).toBe(true);
    expect(getCareerById).toHaveBeenLastCalledWith(8, expect.any(AbortSignal));
    h.unmount();
  });
  it('preserves not-found and error handling', async () => {
    vi.mocked(getCareerById).mockResolvedValue(null);
    const h = hookHarness(() => useCareerStudentImportContext(99, true));

    h.render();
    await vi.waitFor(() => expect(h.render().loading).toBe(false));
    expect(h.render().career).toBeNull();
    vi.mocked(getCareerById).mockRejectedValue(new Error('No disponible'));
    h.render().retry();
    h.render();
    await vi.waitFor(() => expect(h.render().error).toBe('No disponible'));
    h.unmount();
  });
});
