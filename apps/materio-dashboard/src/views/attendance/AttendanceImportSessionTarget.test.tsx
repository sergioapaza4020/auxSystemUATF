import type * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TextField, MenuItem } from '@mui/material';

import { AttendanceImportSessionTarget } from './AttendanceImportDialog';
import type { AttendanceImportPreview } from '@/interfaces/attendances/attendance-import.interface';
import { elements } from '@/test-utils/hook-harness';

type Column = AttendanceImportPreview['columns'][number];

const missing: Column = { column: 'B', date: '2026-08-05', candidates: [], create: true, allowCreate: true };
const manual = { id: 7, mode: 'MANUAL', state: 'MANUAL', editable: true, topic: 'Introducción a Git' };

describe('Destinos de importación sin decisiones redundantes', () => {
  it('muestra la creación manual automática y Sin tema sin selector', () => {
    const html = renderToStaticMarkup(
      <AttendanceImportSessionTarget column={missing} disabled={false} onChange={vi.fn()} />,
    );

    expect(html).toContain('05/08/2026');
    expect(html).toContain('Se creará una sesión manual');
    expect(html).toContain('Sin tema');
    expect(html).not.toContain('role="combobox"');
  });
  it('muestra una sesión existente inequívoca y su tema como información', () => {
    const html = renderToStaticMarkup(
      <AttendanceImportSessionTarget
        column={{ ...missing, create: false, candidates: [manual], selected: manual }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('Sesión 7 · Manual · Editable');
    expect(html).toContain('Introducción a Git');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('Se creará');
  });
  it('conserva el selector solo para múltiples destinos y nunca ofrece crear o elegir modalidad', () => {
    const onChange = vi.fn();

    const tree = AttendanceImportSessionTarget({
      column: {
        ...missing,
        create: false,
        candidates: [manual, { ...manual, id: 8 }, { ...manual, id: 9, mode: 'QR', state: 'CLOSED', editable: false }],
      },
      disabled: false,
      onChange,
    });

    const field = elements<React.ComponentProps<typeof TextField>>(tree, TextField)[0].props;

    expect(field.value).toBe('unresolved');
    field.onChange?.({ target: { value: '8' } } as React.ChangeEvent<HTMLInputElement>);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(8);
    const options = elements<React.ComponentProps<typeof MenuItem>>(tree, MenuItem);

    expect(options.map((item) => item.props.value)).toEqual(['unresolved', 7, 8, 9]);
    expect(options[3].props.disabled).toBe(true);
  });
  it('muestra conflictos protegidos sin habilitar creación adicional', () => {
    const html = renderToStaticMarkup(
      <AttendanceImportSessionTarget
        column={{
          ...missing,
          create: false,
          allowCreate: false,
          candidates: [{ ...manual, mode: 'GEOLOCATION_QR', state: 'CLOSED', editable: false }],
        }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('QR geolocalizado');
    expect(html).toContain('Cerrada');
    expect(html).toContain('No se creará otra sesión');
    expect(html).not.toContain('role="combobox"');
  });
});
