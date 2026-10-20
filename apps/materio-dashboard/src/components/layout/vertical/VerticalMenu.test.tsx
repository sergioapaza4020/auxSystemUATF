import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/hooks/useAuth';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';

import VerticalMenu from './VerticalMenu';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@menu/hooks/useVerticalNav', () => ({
  default: () => ({ isBreakpointReached: true, transitionDuration: 0 }),
}));
vi.mock('@core/styles/vertical/menuItemStyles', () => ({ default: () => ({}) }));
vi.mock('@core/styles/vertical/menuSectionStyles', () => ({ default: () => ({}) }));
vi.mock('@menu/vertical-menu', () => ({
  Menu: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  MenuSection: ({ label, children }: { label: string; children: ReactNode }) => (
    <section aria-label={label}>{children}</section>
  ),
  MenuItem: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const items = [
  ['permission.get-all', '/dashboard/super-admin/permissions'],
  ['session.get-all', '/dashboard/super-admin/sessions'],
  ['role.get-all', '/dashboard/super-admin/roles'],
  ['faculty.get-all', '/dashboard/admin/faculties'],
  ['career.get-all', '/dashboard/admin/careers'],
  ['course.get-all', '/dashboard/admin/courses'],
  ['semester.get-all', '/dashboard/admin/semesters'],
  ['user.get-all', '/dashboard/super-admin/users'],
  ['grade-item.get-all', '/dashboard/admin/grade-items'],
  ['grade-scheme.get-all', '/dashboard/admin/grade-schemes'],
  ['enrollment.get-all', '/dashboard/admin/enrollments'],
];

function renderMenu(permissions: string[], roles = ['CUSTOM'], loading = false, anonymous = false) {
  const user: ICurrentUser = {
    idUser: 1,
    idSession: 1,
    name: 'Test',
    username: 'test',
    email: 'test@example.com',
    roles,
    permissions,
  };

  vi.mocked(useAuth).mockReturnValue({
    user: anonymous ? null : user,
    loading,
    refreshUser: vi.fn(),
    logout: vi.fn(),
  });

  return renderToStaticMarkup(<VerticalMenu scrollMenu={vi.fn()} />);
}

describe('Vertical navigation permissions', () => {
  it.each(items)('shows only the section granted by %s without requiring ADMIN', (permission, href) => {
    const html = renderMenu([permission]);

    expect(html).toContain(`href="${href}"`);

    for (const [, otherHref] of items) {
      if (otherHref !== href) expect(html).not.toContain(`href="${otherHref}"`);
    }
  });

  it('does not grant functional modules based on ADMIN or other persona roles alone', () => {
    for (const role of ['ADMIN', 'ASSISTANT', 'STUDENT', 'DIRECTOR', 'DEAN']) {
      const html = renderMenu([], [role]);

      expect(html).toContain('href="/dashboard"');
      expect(html).not.toContain('<section');

      for (const [, href] of items) expect(html).not.toContain(`href="${href}"`);
    }
  });

  it('keeps all modules and their order for SUPERADMIN without explicit permissions', () => {
    const html = renderMenu([], ['CUSTOM', 'SUPERADMIN']);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(links).toEqual(['/dashboard', ...items.map(([, href]) => href)]);
    expect(html).toContain('aria-label="Super Admininistración"');
    expect(html).toContain('aria-label="Administración"');
  });

  it('shows each parent only when at least one of its children is visible', () => {
    const users = renderMenu(['user.get-all']);
    const roles = renderMenu(['role.get-all']);

    expect(users).toContain('aria-label="Administración"');
    expect(users).not.toContain('aria-label="Super Admininistración"');
    expect(roles).toContain('aria-label="Super Admininistración"');
    expect(roles).not.toContain('aria-label="Administración"');
  });

  it('hides protected entries during loading even with a previously privileged user', () => {
    const html = renderMenu([], ['SUPERADMIN'], true);

    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain('<section');
  });

  it('keeps Inicio but hides protected entries without a known user', () => {
    const html = renderMenu([], [], false, true);

    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain('<section');
  });

  it('does not substitute creation or the mismatched sessions seed permission for listing access', () => {
    expect(renderMenu(['user.create', 'role.create', 'sessions.get-all'])).not.toContain('<section');
  });
});
