import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaginationTable } from '@/components/table';
import { useSessions } from '@/hooks/sessions';
import type { ISession } from '@/interfaces/sessions/session.interface';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { SessionsTable } from './SessionsTable';
import { SessionRow } from './components/SessionRow';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/hooks/sessions', () => ({ useSessions: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useDialog', () => ({ useDialog: () => ({}) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());
describe('Sessions remote table', () => {
  it('renders all received page 2 rows without slicing again and uses the global total', () => {
    const changeQuery = vi.fn();

    vi.mocked(useSessions).mockReturnValue({
      query: { page: 2, limit: 5 },
      sessions: [{ idSession: 10 }, { idSession: 9 }] as ISession[],
      meta: { page: 2, limit: 5, total: 430, totalPages: 86 },
      loading: false,
      error: '',
      changeQuery,
      load: vi.fn(),
    });
    const harness = hookHarness(SessionsTable);
    const tree = harness.render();
    const pagination = elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

    expect(elements(tree, SessionRow)).toHaveLength(2);
    expect(pagination.count).toBe(430);
    expect(pagination.page).toBe(1);
    pagination.onPageChange(null, 2);
    expect(changeQuery).toHaveBeenLastCalledWith({ page: 3 });
    pagination.onRowsPerPageChange({ target: { value: '25' } } as React.ChangeEvent<HTMLInputElement>);
    expect(changeQuery).toHaveBeenLastCalledWith({ limit: 25 });
    harness.unmount();
  });
});
