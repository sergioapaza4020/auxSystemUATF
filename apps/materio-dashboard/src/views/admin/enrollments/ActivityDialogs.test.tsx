import { writeFileSync } from 'node:fs';

import { createElement, type ComponentProps } from 'react';

import { renderToString } from 'react-dom/server';
import type * as MaterialUI from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';

import dialogOverrides from '@core/theme/overrides/dialog';
import spacing from '@core/theme/spacing';
import { ActivityManagementDialog } from './ActivityManagementDialog';
import { ActivityFormDialog } from './ActivityFormDialog';

vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: vi.fn() }) }));

// Keep real dialogs and styling; SSR cannot mount a portal into document.body.
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialUI>();

  return {
    ...actual,
    Dialog: (props: ComponentProps<typeof actual.Dialog>) =>
      createElement(actual.Dialog, { ...props, disablePortal: true, TransitionComponent: ({ children }) => children }),
  };
});
const theme = createTheme({ ...spacing, components: dialogOverrides('bordered') });

const common = {
  open: true,
  saving: false,
  idGradeSchemeDetail: 4,
  onClose: () => undefined,
  onCreate: async () => undefined,
  onUpdate: async () => undefined,
};

describe('Activity dialog actions', () => {
  it.each(['management', 'creation'] as const)('renders %s actions with explicit spacing and wrapping', (mode) => {
    const element =
      mode === 'management'
        ? createElement(ActivityManagementDialog, {
            ...common,
            loading: false,
            activities: [{ idActivity: 1, name: 'Práctica 1', dueDate: '2026-10-20', isActive: true }],
            gradeItemName: 'Prácticas',
            onDelete: async () => undefined,
          })
        : createElement(ActivityFormDialog, { ...common, activity: null });

    const html = renderToString(<ThemeProvider theme={theme}>{element}</ThemeProvider>);

    const actionsCss = html.match(/<style[^>]*>[^<]*MuiDialogActions-root[^<]*<\/style>/g)?.join('') ?? '';

    expect(actionsCss).toContain(`gap:${theme.spacing(2)};`);
    expect(html).toContain('flex-wrap:wrap');
    expect(html).not.toContain('MuiDialogActions-spacing');
    expect(html).toContain(mode === 'management' ? 'Cerrar' : 'Cancelar');
    expect(html).toContain(mode === 'management' ? 'Nueva actividad' : 'Crear actividad');

    if (process.env.ACTIVITY_MODAL_PREVIEW_DIR) {
      writeFileSync(
        `${process.env.ACTIVITY_MODAL_PREVIEW_DIR}/${mode}.html`,
        `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verificación aislada del modal de actividades</title><body>${html}</body></html>`,
      );
    }
  });
});
