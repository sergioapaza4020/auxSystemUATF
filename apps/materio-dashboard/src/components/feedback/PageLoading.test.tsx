import type { ComponentProps } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Box, CircularProgress, Stack, Typography, ThemeProvider, createTheme } from '@mui/material';

import { elements } from '@/test-utils/hook-harness';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useAuth } from '@/hooks/useAuth';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { TableAction } from '@/components/table/components/TableAction';
import { TableMessageRow } from '@/components/table/components/TableMessageRow';
import { GradesSummary } from '@/views/admin/enrollments/grades-card/GradesSummary';
import { LoadingOverlay } from './LoadingOverlay';
import { PageLoading } from './PageLoading';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

describe('PageLoading', () => {
  it('announces the default message once and places it after the hidden spinner in a horizontal row', () => {
    const tree = PageLoading({});
    const html = renderToStaticMarkup(tree);
    const row = elements<ComponentProps<typeof Stack>>(tree, Stack)[0].props;

    expect(row).toMatchObject({ direction: 'row', alignItems: 'center', spacing: 2 });
    expect(elements<ComponentProps<typeof CircularProgress>>(tree, CircularProgress)[0].props).toMatchObject({
      size: 26,
      color: 'primary',
      'aria-hidden': 'true',
    });
    expect(elements<ComponentProps<typeof Typography>>(tree, Typography)[0].props.children).toBe('Cargando...');
    expect(html.match(/Cargando\.\.\./g)).toHaveLength(1);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html.indexOf('MuiCircularProgress-root')).toBeLessThan(html.indexOf('Cargando...'));
  });

  it('supports the fullscreen size and container flex without imposing viewport height', () => {
    const tree = PageLoading({
      variant: 'fullscreen',
      minHeight: 300,
      message: 'Preparando la vista',
      className: 'initial-load',
    });

    expect(elements<ComponentProps<typeof CircularProgress>>(tree, CircularProgress)[0].props.size).toBe(32);
    expect(elements<ComponentProps<typeof Box>>(tree, Box)[0].props.className).toBe('initial-load');
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Preparando la vista');
    expect(html).toContain('min-height:300px');
    expect(html).toContain('flex:1 1 auto');
    expect(html).not.toContain('100vh');
  });

  it.each(['light', 'dark'] as const)('uses the %s theme, flexible width and reduced-motion preference', (mode) => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <PageLoading sx={{ py: 3 }} />
      </ThemeProvider>,
    );

    expect(html).toContain('MuiCircularProgress-colorPrimary');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain('animation:none');
    expect(html).toContain('Cargando...');
  });

  it('keeps the shared initial table state and full-body loading row labelled', () => {
    expect(renderToStaticMarkup(<LoadingTable />)).toContain('Cargando...');

    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <TableMessageRow colSpan={4} loading />
        </tbody>
      </table>,
    );

    expect(html).toContain('colSpan="4"');
    expect(html).toContain('Cargando...');

    const completed = renderToStaticMarkup(
      <table>
        <tbody>
          <TableMessageRow colSpan={4}>Sin registros</TableMessageRow>
        </tbody>
      </table>,
    );

    expect(completed).toContain('Sin registros');
    expect(completed).not.toContain('Cargando...');
  });

  it('shows the shared loading state in protected content, then preserves denied and authorized outcomes', () => {
    const auth = { user: null, loading: true, refreshUser: vi.fn(), logout: vi.fn() };

    vi.mocked(useAuth).mockReturnValue(auth);

    const view = () =>
      renderToStaticMarkup(
        <PermissionGate permission='role.get-all'>
          <p>Contenido autorizado</p>
        </PermissionGate>,
      );

    expect(view()).toContain('Cargando...');
    expect(view()).not.toContain('Contenido autorizado');
    vi.mocked(useAuth).mockReturnValue({ ...auth, loading: false });
    expect(view()).toContain('No tienes permiso');
    expect(view()).not.toContain('Cargando...');
    vi.mocked(useAuth).mockReturnValue({
      ...auth,
      loading: false,
      user: {
        idUser: 1,
        idSession: 1,
        name: 'Test',
        username: 'test',
        email: 'test@example.com',
        roles: ['SUPERADMIN'],
        permissions: [],
      },
    });
    expect(view()).toContain('Contenido autorizado');
    expect(view()).not.toContain('Cargando...');
  });
});

describe('small and operational indicators remain excluded', () => {
  it('does not add the page message to row actions or saving overlays', () => {
    const action = renderToStaticMarkup(<TableAction intent='edit' label='Editar' loading />);
    const overlay = renderToStaticMarkup(<LoadingOverlay open />);

    expect(action).toContain('MuiCircularProgress-root');
    expect(overlay).toContain('MuiCircularProgress-root');
    expect(action + overlay).not.toContain('Cargando...');
  });

  it('preserves determinate academic percentage rings as data, not loading', () => {
    const html = renderToStaticMarkup(<GradesSummary evaluatedPercentage={75} currentScore={60} maximumScore={100} />);

    expect(html).toContain('aria-valuenow="75"');
    expect(html).not.toContain('Cargando...');
  });
});
