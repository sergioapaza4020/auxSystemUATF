import type { ComponentProps } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button, IconButton, TextField, ThemeProvider, Tooltip, createTheme } from '@mui/material';

import { elements } from '@/test-utils/hook-harness';
import { TableAction } from './TableAction';
import { TableActions } from './TableActions';
import { TableToolbar } from './TableToolbar';

describe('table actions and controls', () => {
  it.each([
    ['edit', 'warning'],
    ['delete', 'error'],
    ['view', 'info'],
    ['activate', 'success'],
    ['deactivate', 'error'],
    ['restore', 'success'],
    ['assign', 'primary'],
    ['history', 'info'],
  ] as const)('%s retains its label, callback and semantic color %s', (intent, color) => {
    const onClick = vi.fn();
    const tree = TableAction({ intent, label: 'Acción del registro', onClick });
    const button = elements<ComponentProps<typeof IconButton>>(tree, IconButton)[0].props;

    expect(button).toMatchObject({ color, 'aria-label': 'Acción del registro', size: 'small' });
    expect(button.onClick).toBe(onClick);
    expect(elements<ComponentProps<typeof Tooltip>>(tree, Tooltip)[0].props.title).toBe('Acción del registro');
  });

  it('preserves conditional edit, deactivate and restore actions', () => {
    const onEdit = vi.fn(),
      onDelete = vi.fn(),
      onRestore = vi.fn();

    const active = elements<ComponentProps<typeof TableAction>>(
      TableActions({ active: true, onEdit, onDelete, onRestore }),
      TableAction,
    );

    expect(active.map((element) => element.props.intent)).toEqual(['edit', 'deactivate']);

    const inactive = elements<ComponentProps<typeof TableAction>>(
      TableActions({ active: false, onEdit, onDelete, onRestore }),
      TableAction,
    );

    expect(inactive.map((element) => element.props.intent)).toEqual(['restore']);
    expect(
      elements<ComponentProps<typeof TableAction>>(
        TableActions({ active: true, deleteLabel: 'Eliminar', onDelete }),
        TableAction,
      )[0].props.intent,
    ).toBe('delete');
  });

  it('uses native disabled colors and loading while exposing the reason', () => {
    const tree = TableAction({
      intent: 'edit',
      label: 'Editar',
      disabled: true,
      disabledReason: 'Registro protegido',
      loading: true,
    });

    expect(elements<ComponentProps<typeof IconButton>>(tree, IconButton)[0].props).toMatchObject({
      disabled: true,
      'aria-busy': true,
    });
    expect(elements<ComponentProps<typeof Tooltip>>(tree, Tooltip)[0].props.title).toContain('Registro protegido');
  });

  it('blocks refresh when dirty and does not manufacture an action for local data', () => {
    const onRefresh = vi.fn();
    const tree = TableToolbar({ onRefresh, refreshDisabled: true, refreshReason: 'Hay cambios sin guardar' });
    const button = elements<ComponentProps<typeof Button>>(tree, Button)[0].props;

    button.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(button.disabled).toBe(true);
    expect(elements(TableToolbar({ title: 'Preferencias locales' }), Button)).toHaveLength(0);
  });

  it('composes filters without replacing handlers or pagination state and refreshes once', () => {
    const onRefresh = vi.fn(),
      onChange = vi.fn();

    const tree = TableToolbar({
      onRefresh,
      children: <TextField label='Buscar estudiante' value='Ana' onChange={onChange} />,
    });

    const field = elements<ComponentProps<typeof TextField>>(tree, TextField)[0].props;

    expect(field).toMatchObject({ value: 'Ana', onChange });
    elements<ComponentProps<typeof Button>>(tree, Button)[0].props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it.each(['light', 'dark'] as const)('renders comfortable spacing and accessible icon buttons in %s', (mode) => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <TableToolbar onRefresh={() => {}}>
          <TextField label='Buscar registro' />
        </TableToolbar>
        <TableAction intent='edit' label='Editar' />
      </ThemeProvider>,
    );

    expect(html).toContain('aria-label="Editar"');
    expect(html).toContain('MuiIconButton-colorWarning');
    expect(html).toContain('padding-top:16px');
    expect(html).toContain('flex-wrap:wrap');
    expect(html).toContain('min-height:36px');
  });
});
