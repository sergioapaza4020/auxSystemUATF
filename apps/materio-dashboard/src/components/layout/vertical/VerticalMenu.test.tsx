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
  ['sessions.get-all', '/dashboard/super-admin/sessions'],
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

function renderMenu(permissions: string[], roles = ['ADMIN'], loading = false, anonymous = false) {
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

const superItems = items.slice(0, 3);
const adminItems = items.slice(3);
const allPermissions = items.map(([permission]) => permission);

function sectionLinks(html: string, label: string) {
  const section = html.match(new RegExp(`<section aria-label="${label}">([\\s\\S]*?)</section>`))?.[1] ?? '';

  return [...section.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

describe('Vertical navigation sections and permissions', () => {
  it.each([
    ['STUDENT', false, false],
    ['ASSISTANT', false, false],
    ['ADMIN', false, true],
    ['TEACHER', false, false],
    ['DIRECTOR', false, false],
    ['DEAN', false, true],
    ['SUPERADMIN', true, true],
  ] as const)(
    'uses the real role matrix for %s even when every permission is granted',
    (role, superSection, adminSection) => {
      const html = renderMenu(allPermissions, [role]);

      expect(html).toContain('href="/dashboard"');
      expect(html.includes('aria-label="Superadministración"')).toBe(superSection);
      expect(html.includes('aria-label="Administración"')).toBe(adminSection);
      expect(sectionLinks(html, 'Superadministración')).toEqual(superSection ? superItems.map(([, href]) => href) : []);
      expect(sectionLinks(html, 'Administración')).toEqual(adminSection ? adminItems.map(([, href]) => href) : []);

      if (!superSection && !adminSection) {
        expect(html).not.toContain('<section');
        expect([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(['/dashboard']);
      }
    },
  );

  it.each(adminItems)('shows only the administrative item granted by %s for ADMIN', (permission, href) => {
    const html = renderMenu([permission]);

    expect(sectionLinks(html, 'Administración')).toEqual([href]);
    expect(html).not.toContain('aria-label="Superadministración"');

    for (const [, otherHref] of items) {
      if (otherHref !== href) expect(html).not.toContain(`href="${otherHref}"`);
    }
  });

  it.each(['STUDENT', 'ASSISTANT', 'ADMIN', 'TEACHER', 'DIRECTOR', 'DEAN', 'CUSTOM'])(
    'never renders any superadministration title or child for %s',
    (role) => {
      const html = renderMenu(allPermissions, [role]);

      expect(html).not.toContain('aria-label="Superadministración"');
      for (const [, href] of superItems) expect(html).not.toContain(`href="${href}"`);
    },
  );

  it.each(['ADMIN', 'DEAN'])('hides empty administration for %s', (role) => {
    expect(renderMenu([], [role])).not.toContain('<section');
    expect(renderMenu(['role.get-all', 'permission.get-all', 'sessions.get-all'], [role])).not.toContain('<section');
  });

  it('keeps only Usuarios for ADMIN with user.get-all and does not grant other items by role', () => {
    const html = renderMenu(['user.get-all'], ['ADMIN']);

    expect(sectionLinks(html, 'Administración')).toEqual(['/dashboard/super-admin/users']);
    expect(html).not.toContain('href="/dashboard/super-admin/roles"');
    expect(html).not.toContain('href="/dashboard/super-admin/permissions"');
  });

  it.each([
    [['STUDENT', 'ASSISTANT'], false, false],
    [['STUDENT', 'ADMIN'], false, true],
    [['TEACHER', 'DEAN'], false, true],
    [['ADMIN', 'SUPERADMIN'], true, true],
    [['CUSTOM', 'SUPERADMIN'], true, true],
  ] as const)('considers every role in %j', (roles, superSection, adminSection) => {
    const html = renderMenu(['user.get-all'], [...roles]);

    expect(html.includes('aria-label="Superadministración"')).toBe(superSection);
    expect(html.includes('aria-label="Administración"')).toBe(adminSection);
  });

  it('preserves the SUPERADMIN permission bypass and link order', () => {
    const html = renderMenu([], ['CUSTOM', 'SUPERADMIN']);

    expect([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual([
      '/dashboard',
      ...items.map(([, href]) => href),
    ]);
    expect(sectionLinks(html, 'Superadministración')).toEqual(superItems.map(([, href]) => href));
    expect(sectionLinks(html, 'Administración')).toEqual(adminItems.map(([, href]) => href));
  });

  it('does not infer administration access for a custom role with all permissions', () => {
    expect(renderMenu(allPermissions, ['CUSTOM'])).not.toContain('<section');
  });

  it('hides protected sections during loading and shows them only after auth resolves', () => {
    const pending = renderMenu([], ['SUPERADMIN'], true);

    expect(pending).toContain('href="/dashboard"');
    expect(pending).not.toContain('<section');
    const ready = renderMenu([], ['SUPERADMIN']);

    expect(ready).toContain('aria-label="Superadministración"');
    expect(ready).toContain('aria-label="Administración"');
  });

  it('keeps Inicio without granting sections to a null user', () => {
    const html = renderMenu(allPermissions, ['SUPERADMIN'], false, true);

    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain('<section');
  });

  it('does not substitute creation or singular session permissions for listing access', () => {
    expect(renderMenu(['user.create', 'role.create', 'session.get-all'])).not.toContain('<section');
  });
});
