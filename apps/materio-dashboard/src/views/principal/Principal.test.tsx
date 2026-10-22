import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardActionArea } from '@mui/material';

import { getMyEnrollments } from '@/api/enrollments.service';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { EnrollmentCard } from '@/components/principal/EnrollmentCard';
import { UserRole } from '@/enums/userRole';
import type { IMyEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { Principal } from './Principal';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  snackbar: { error: vi.fn(), open: false },
  auth: { user: { idUser: 5, name: 'Ana' } as { idUser: number; name: string } | null, loading: false },
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks.snackbar }));
vi.mock('@/api/enrollments.service', () => ({ getMyEnrollments: vi.fn() }));

const row = (role: UserRole, idEnrollment: number): IMyEnrollment => ({
  idEnrollment,
  role,
  isActive: true,
  course: { idCourse: 3, code: 'SIS', name: 'Materia', group: 1, isActive: true },
  semester: { idSemester: 20, year: 2026, period: 'II', startDate: '', endDate: '', isActive: true },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = { user: { idUser: 5, name: 'Ana' }, loading: false };
  mocks.snackbar = { error: vi.fn(), open: false };
});

describe('Current subjects', () => {
  it('loads current subject cards for student and assistant without needing user, scheme or activities', async () => {
    vi.mocked(getMyEnrollments).mockResolvedValue([row(UserRole.STUDENT, 10), row(UserRole.ASSISTANT, 11)]);
    const h = hookHarness(Principal);

    h.render();
    await vi.waitFor(() => expect(elements(h.render(), EnrollmentCard)).toHaveLength(2));
    expect(getMyEnrollments).toHaveBeenCalledWith(expect.any(AbortSignal));
    const card = EnrollmentCard({ enrollment: row(UserRole.ASSISTANT, 11) });

    elements<React.ComponentProps<typeof CardActionArea>>(card, CardActionArea)[0].props.onClick?.(
      {} as React.MouseEvent<HTMLButtonElement>,
    );
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/enrollments/11');
    h.unmount();
  });
  it('keeps an empty current semester empty', async () => {
    vi.mocked(getMyEnrollments).mockResolvedValue([]);
    const h = hookHarness(Principal);

    h.render();
    await Promise.resolve();
    await Promise.resolve();
    expect(elements(h.render(), EnrollmentCard)).toHaveLength(0);
    h.unmount();
  });
  it('aborts the request when leaving the page', () => {
    vi.mocked(getMyEnrollments).mockResolvedValue([]);
    const h = hookHarness(Principal);

    h.render();
    h.unmount();
    expect(vi.mocked(getMyEnrollments).mock.calls[0][0]?.aborted).toBe(true);
  });
});

describe('Auth and notification lifecycle', () => {
  const html = (tree: React.ReactNode) => renderToStaticMarkup(tree);

  it('waits for auth, fetches once and ignores subsequent user/context renders', async () => {
    mocks.auth = { user: null, loading: true };
    vi.mocked(getMyEnrollments).mockResolvedValue([]);
    const h = hookHarness(Principal);

    expect(html(h.render())).not.toContain('No tienes materias matriculadas');
    expect(getMyEnrollments).not.toHaveBeenCalled();
    mocks.auth = { user: { idUser: 5, name: 'Ana' }, loading: false };
    h.render();
    await Promise.resolve();
    expect(html(h.render())).toContain('No tienes materias matriculadas');

    for (const open of [true, false, true]) {
      mocks.snackbar = { ...mocks.snackbar, open };
      mocks.auth = { ...mocks.auth, user: { idUser: 5, name: 'Updated' } };
      h.render();
    }

    expect(getMyEnrollments).toHaveBeenCalledTimes(1);
    h.unmount();
  });
  it('keeps a failed request in error state and emits only one notification', async () => {
    vi.mocked(getMyEnrollments).mockRejectedValue(new Error('403 Insufficient permissions'));
    const h = hookHarness(Principal);

    h.render();
    await Promise.resolve();
    const result = html(h.render());

    expect(result).toContain('403 Insufficient permissions');
    expect(result).not.toContain('No tienes materias matriculadas');

    for (const open of [true, false]) {
      mocks.snackbar = { ...mocks.snackbar, open };
      h.render();
    }

    expect(getMyEnrollments).toHaveBeenCalledTimes(1);
    expect(mocks.snackbar.error).toHaveBeenCalledTimes(1);
    h.unmount();
  });
});
