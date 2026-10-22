import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaginationTable } from '@/components/table';
import { useSessions } from '@/hooks/sessions';
import type { ISession } from '@/interfaces/sessions/session.interface';
import { deferred, elements, hookHarness } from '@/test-utils/hook-harness';
import { revokeSessionById } from '@/api/sessions.service';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { TableActions } from '@/components/table/components/TableActions';
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

const state = vi.hoisted(() => ({
  user: null as ICurrentUser | null,
  confirm: vi.fn<() => Promise<boolean>>(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useDialog', () => ({ useDialog: () => ({ confirm: state.confirm }) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: state.error, success: state.success }) }));
vi.mock('@/api/sessions.service', () => ({ revokeSessionById: vi.fn() }));

const session = { idSession: 7, isActive: true, user: { username: 'target-user' } } as ISession;
const load = vi.fn();
const changeQuery = vi.fn();

const administrator: ICurrentUser = {
  idUser: 99,
  idSession: 99,
  name: 'Administrator',
  username: 'admin',
  email: 'admin@example.test',
  roles: ['SUPERADMIN'],
  permissions: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  state.user = { ...administrator };
  state.confirm.mockResolvedValue(true);
  vi.mocked(revokeSessionById).mockResolvedValue({ ...session, isActive: false });
  vi.mocked(useSessions).mockReturnValue({
    query: { page: 2, limit: 5 },
    sessions: [session],
    meta: { page: 2, limit: 5, total: 11, totalPages: 3 },
    loading: false,
    error: '',
    changeQuery,
    load,
  });
});

function row(tree: React.ReactNode) {
  return elements<React.ComponentProps<typeof SessionRow>>(tree, SessionRow)[0].props;
}

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

  it('confirms the target user, revokes once and refetches the current page with success feedback', async () => {
    const harness = hookHarness(SessionsTable);

    row(harness.render()).onDelete(7);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(state.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Cerrar la sesión de target-user?',
        text: expect.stringContaining('en su próxima solicitud'),
      }),
    );
    expect(revokeSessionById).toHaveBeenCalledExactlyOnceWith(7);
    expect(state.success).toHaveBeenCalledWith('Sesión revocada con éxito');
    expect(changeQuery).not.toHaveBeenCalled();
    expect(
      elements<React.ComponentProps<typeof PaginationTable>>(harness.render(), PaginationTable)[0].props.page,
    ).toBe(1);
    harness.unmount();
  });

  it('locks immediately during confirmation and the request, including duplicate callbacks', async () => {
    const confirmation = deferred<boolean>();
    const request = deferred<ISession>();

    state.confirm.mockReturnValue(confirmation.promise);
    vi.mocked(revokeSessionById).mockReturnValue(request.promise);
    const harness = hookHarness(SessionsTable);
    const stale = row(harness.render());

    stale.onDelete(7);
    stale.onDelete(7);
    expect(state.confirm).toHaveBeenCalledTimes(1);
    expect(row(harness.render()).processing).toBe(true);
    confirmation.resolve(true);
    await vi.waitFor(() => expect(revokeSessionById).toHaveBeenCalledTimes(1));
    stale.onDelete(7);
    expect(revokeSessionById).toHaveBeenCalledTimes(1);
    expect(row(harness.render()).processing).toBe(true);
    request.resolve({ ...session, isActive: false });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(row(harness.render()).processing).toBe(false);
    harness.unmount();
  });

  it('does nothing after cancellation', async () => {
    state.confirm.mockResolvedValue(false);
    const harness = hookHarness(SessionsTable);

    row(harness.render()).onDelete(7);
    await vi.waitFor(() => expect(row(harness.render()).processing).toBe(false));
    expect(revokeSessionById).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('reports errors without removing rows or refetching success', async () => {
    vi.mocked(revokeSessionById).mockRejectedValue(new Error('No se pudo revocar'));
    const harness = hookHarness(SessionsTable);

    row(harness.render()).onDelete(7);
    await vi.waitFor(() => expect(state.error).toHaveBeenCalledWith('No se pudo revocar'));
    expect(load).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(row(harness.render()).session).toBe(session);
    expect(row(harness.render()).processing).toBe(false);
    harness.unmount();
  });

  it.each([
    { roles: ['SUPERADMIN'], permissions: [], allowed: true },
    { roles: ['ADMIN'], permissions: ['sessions.revoke-one'], allowed: true },
    { roles: ['ADMIN'], permissions: [], allowed: false },
  ])('shows the action according to existing permissions: %j', ({ roles, permissions, allowed }) => {
    state.user = { ...administrator, roles, permissions };
    const tree = SessionRow({ session, onDelete: vi.fn(), processing: true });
    const action = elements<React.ComponentProps<typeof TableActions>>(tree, TableActions)[0].props;

    expect(!!action.onDelete).toBe(allowed);
    expect(action.disabled).toBe(true);
    expect(action.deleteLabel).toBe('Cerrar sesión');
  });

  it('does not permit callbacks without authorization and keeps own/inactive sessions unavailable', () => {
    state.user = { ...administrator, roles: [], permissions: [] };
    const harness = hookHarness(SessionsTable);

    row(harness.render()).onDelete(7);
    expect(state.confirm).not.toHaveBeenCalled();
    state.user = { ...administrator, idSession: 7 };

    for (const value of [session, { ...session, idSession: 8, isActive: false }]) {
      const tree = SessionRow({ session: value, onDelete: vi.fn() });

      expect(elements<React.ComponentProps<typeof TableActions>>(tree, TableActions)[0].props.active).toBe(false);
    }

    harness.unmount();
  });
});
