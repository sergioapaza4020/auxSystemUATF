import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/hooks/useAuth';
import RolesPage from '@/app/dashboard/super-admin/roles/page';
import SessionsPage from '@/app/dashboard/super-admin/sessions/page';
import GradeSchemesPage from '@/app/dashboard/admin/grade-schemes/page';

const { mountTable } = vi.hoisted(() => ({ mountTable: vi.fn() }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/skeletons/table/LoadingTable', () => ({ LoadingTable: () => <p>Cargando</p> }));
vi.mock('@/views/super-admin/roles/RolesTable', () => ({
  RolesTable: () => {
    mountTable();

    return <p>Roles</p>;
  },
}));
vi.mock('@/views/super-admin/sessions/SessionsTable', () => ({
  SessionsTable: () => {
    mountTable();

    return <p>Sesiones</p>;
  },
}));
vi.mock('@/views/admin/grade-schemes/GradeSchemesTable', () => ({
  GradeSchemesTable: () => {
    mountTable();

    return <p>Esquemas</p>;
  },
}));

function setUser(permissions: string[], roles = ['CUSTOM'], loading = false) {
  vi.mocked(useAuth).mockReturnValue({
    user: { idUser: 1, idSession: 1, name: 'Test', username: 'test', email: 'test@example.com', roles, permissions },
    loading,
    refreshUser: vi.fn(),
    logout: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());

describe.each([
  { permission: 'role.get-all', Page: RolesPage },
  { permission: 'session.get-all', Page: SessionsPage },
  { permission: 'grade-scheme.get-all', Page: GradeSchemesPage },
])('Direct route access: $permission', ({ permission, Page }) => {
  it('does not mount the section without its listing permission', () => {
    setUser(['user.get-all']);

    expect(renderToStaticMarkup(<Page />)).toContain('No tienes permiso');
    expect(mountTable).not.toHaveBeenCalled();
  });

  it('does not mount the section while auth is loading', () => {
    setUser([], ['SUPERADMIN'], true);

    expect(renderToStaticMarkup(<Page />)).toContain('Cargando');
    expect(mountTable).not.toHaveBeenCalled();
  });

  it('allows the listing permission without ADMIN', () => {
    setUser([permission]);
    renderToStaticMarkup(<Page />);
    expect(mountTable).toHaveBeenCalledOnce();
  });

  it('preserves the SUPERADMIN bypass', () => {
    setUser([], ['SUPERADMIN']);
    renderToStaticMarkup(<Page />);
    expect(mountTable).toHaveBeenCalledOnce();
  });
});
