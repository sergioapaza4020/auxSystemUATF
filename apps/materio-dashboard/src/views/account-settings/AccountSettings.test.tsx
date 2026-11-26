import type * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SectionNavigation from '@/components/SectionNavigation';
import { useAuth } from '@/hooks/useAuth';

import AccountSettings from './index';

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof React>();

  return { ...react, useLayoutEffect: react.useEffect };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ success: vi.fn() }) }));

const auth = { loading: false, refreshUser: vi.fn(), logout: vi.fn() };

it('provides accessible navigation for more than two sections', () => {
  const items = [
    { id: 'overview', label: 'Resumen' },
    { id: 'details', label: 'Detalles' },
    { id: 'history', label: 'Historial' },
  ];

  const markup = renderToStaticMarkup(<SectionNavigation label='Secciones' items={items} />);

  for (const { id, label } of items) {
    expect(markup).toContain(`href="#${id}"`);
    expect(markup).toContain(label);
  }

  expect(markup.match(/aria-current="location"/g)).toHaveLength(1);
  expect(markup).not.toMatch(/role="tab/);
});

describe('Configuración de cuenta', () => {
  it('renders links to both mounted sections and the authenticated profile', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...auth,
      user: {
        idUser: 7,
        idSession: 31,
        name: 'Daniela',
        lastname: 'Mamani',
        email: 'daniela@test.invalid',
        username: 'dmamani',
        ci: '0012345-1A',
        ru: '0006789',
        roles: ['STUDENT', 'ASSISTANT'],
        permissions: [],
      },
    });
    const markup = renderToStaticMarkup(<AccountSettings />);

    for (const value of [
      'Mi perfil',
      'Seguridad de la cuenta',
      'Daniela',
      'Mamani',
      'STUDENT',
      'ASSISTANT',
      'Cédula de identidad (CI)',
      'Registro Universitario (RU)',
      'Información personal',
      'Información de la cuenta',
      'dmamani',
      '0012345-1A',
      '0006789',
    ]) {
      expect(markup).toContain(value);
    }

    for (const [field, value] of [
      ['name', 'Daniela'],
      ['lastname', 'Mamani'],
      ['email', 'daniela@test.invalid'],
    ]) {
      expect(markup).toContain(`for="profile-${field}"`);
      expect(markup).toMatch(new RegExp(`<input(?=[^>]*id="profile-${field}")(?=[^>]*value="${value}")[^>]*>`, 'i'));
    }

    expect(markup.match(/<input\b[^>]*id="profile-/gi)).toHaveLength(3);
    expect(markup).not.toMatch(/readonly=""|id="profile-(username|ci|ru)"/i);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Guardar cambios<\/button>/);
    expect(markup).toContain('Cancelar');
    expect(markup).toContain('Cambiar foto');
    expect(markup).not.toContain('Quitar foto');
    expect(markup).not.toContain('Te enviaremos un enlace para confirmar la nueva dirección.');
    expect(markup).not.toContain('Pendiente de verificación');
    expect(markup).toContain('aria-label="Secciones de configuración de cuenta"');
    expect(markup).toContain('href="#account-profile-section"');
    expect(markup).toContain('href="#account-security-section"');
    expect(markup).toContain('aria-current="location"');
    expect(markup).toMatch(/<section[^>]*id="account-profile-section"/);
    expect(markup).toMatch(/<section[^>]*id="account-security-section"/);
    expect(markup).not.toMatch(/role="tab"|Notifications|Connections|Teléfono/);
  });

  it('renders loading without profile data and supports missing optional values', () => {
    vi.mocked(useAuth).mockReturnValue({ ...auth, user: null, loading: true });
    const loading = renderToStaticMarkup(<AccountSettings />);

    expect(loading).toContain('Cargando perfil');
    expect(loading).not.toMatch(/Mi perfil|Sesiones activas|dmamani/);
    vi.mocked(useAuth).mockReturnValue({
      ...auth,
      user: {
        idUser: 8,
        idSession: 41,
        name: 'Ana',
        email: 'ana@test.invalid',
        username: 'ana',
        ci: '   ',
        ru: null,
        roles: [],
        permissions: [],
      },
    });
    const markup = renderToStaticMarkup(<AccountSettings />);

    expect(markup.match(/>No registrado</g)).toHaveLength(2);
    expect(markup).toContain('Sin roles asignados');
    expect(markup).not.toMatch(/dmamani|0012345-1A|0006789|No aplica/);
  });
});
