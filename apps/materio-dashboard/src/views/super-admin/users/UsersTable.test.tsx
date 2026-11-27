import type * as React from 'react';

import { Button, Dialog, Typography } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { elements, hookHarness } from '@/test-utils/hook-harness';
import type { IUser } from '@/interfaces/users/user.interface';
import { UsersTable } from './UsersTable';
import { UserRow } from './components/UserRow';

const fixture = vi.hoisted(() => ({
  actor: { idUser: 1, roles: ['SUPERADMIN'], permissions: ['user.get-all', 'user.reset-password'] },
  send: vi.fn<(id: number) => Promise<void>>(),
  run: vi.fn<(action: () => Promise<void>) => Promise<void>>(),
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: fixture.actor, loading: false, refreshUser: vi.fn() }),
}));
vi.mock('@/hooks/users/useUsersPage', () => ({
  useUsersPage: () => ({
    rows: [{ idUser: 2, name: 'Ana', lastname: 'Pérez', roles: [], isActive: true }],
    query: { search: '', status: 'all' },
    meta: {},
  }),
}));
vi.mock('@/hooks/users/useUserRoleOptions', () => ({ useUserRoleOptions: () => ({ roles: [] }) }));
vi.mock('@/hooks/users/useUserMutations', () => ({
  useUserMutations: () => ({ busy: false, clearError: vi.fn(), run: fixture.run }),
}));
vi.mock('@/api/users.service', () => ({ requestUserPasswordReset: fixture.send }));

describe('restablecimiento administrativo desde la tabla', () => {
  it('muestra el objetivo, permite cancelar e inicia una solicitud al confirmar', async () => {
    fixture.run.mockImplementation((action) => action());
    const table = hookHarness(UsersTable);
    const rows = () => elements<{ user: IUser; onResetPassword?: () => void }>(table.render(), UserRow);
    const buttons = () => elements<{ children: string; onClick?: () => void }>(table.render(), Button);

    rows()[0].props.onResetPassword?.();
    expect(elements(table.render(), Dialog)).toHaveLength(1);
    expect(
      elements<{ children: React.ReactNode }>(table.render(), Typography).some(
        ({ props }) => ReactText(props.children) === 'Ana Pérez',
      ),
    ).toBe(true);
    buttons()
      .find(({ props }) => props.children === 'Cancelar')
      ?.props.onClick?.();
    expect(elements(table.render(), Dialog)).toHaveLength(0);
    expect(fixture.send).not.toHaveBeenCalled();

    rows()[0].props.onResetPassword?.();
    buttons()
      .find(({ props }) => props.children === 'Restablecer contraseña')
      ?.props.onClick?.();
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('oculta la acción para otros actores aunque puedan consultar usuarios', () => {
    fixture.actor.roles = ['ADMIN'];
    const table = hookHarness(UsersTable);

    expect(
      elements<{ onResetPassword?: () => void }>(table.render(), UserRow)[0].props.onResetPassword,
    ).toBeUndefined();
    fixture.actor.roles = ['SUPERADMIN'];
  });
});

function ReactText(children: React.ReactNode) {
  return Array.isArray(children) ? children.join('') : children;
}
