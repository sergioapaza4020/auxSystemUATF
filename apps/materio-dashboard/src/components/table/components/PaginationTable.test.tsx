import type { ComponentProps } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, Select, ThemeProvider, createTheme } from '@mui/material';

import { elements } from '@/test-utils/hook-harness';
import { PaginationTable } from './PaginationTable';
import { DataTableContainer } from './DataTableContainer';

const props = () => ({ count: 26, page: 0, rowsPerPage: 5, onPageChange: vi.fn(), onRowsPerPageChange: vi.fn() });

describe('shared table presentation and pagination', () => {
  it.each([
    [0, '1-5'],
    [5, '26-26'],
    [9, '0-0'],
  ])('reports true range on page %s', (page, range) => {
    const markup = renderToStaticMarkup(<PaginationTable {...props()} page={page} />);

    expect(markup).toContain(`Mostrando ${range} de 26 resultados`);
  });

  it('shows an empty range and disables navigation with no rows', () => {
    const tree = PaginationTable({ ...props(), count: 0 });

    expect(elements<ComponentProps<typeof Pagination>>(tree, Pagination)[0].props.disabled).toBe(true);
    expect(renderToStaticMarkup(tree)).toContain('Mostrando 0-0 de 0 resultados');
  });

  it('keeps backend page-size options and emits one zero-based page change', () => {
    const state = props();
    const tree = PaginationTable({ ...state, rowsPerPage: 20, rowsPerPageOptions: [20, 50, 100] });
    const pager = elements<ComponentProps<typeof Pagination>>(tree, Pagination)[0].props;
    const select = elements<ComponentProps<typeof Select>>(tree, Select)[0].props;

    pager.onChange?.({} as React.ChangeEvent<unknown>, 1);
    expect(state.onPageChange).not.toHaveBeenCalled();
    pager.onChange?.({} as React.ChangeEvent<unknown>, 2);
    expect(state.onPageChange).toHaveBeenCalledExactlyOnceWith(null, 1);
    expect(select.value).toBe(20);
    expect(select.inputProps?.['aria-label']).toBe('Filas por página');
  });

  it('does not dispatch navigation while loading', () => {
    const state = props();
    const tree = PaginationTable({ ...state, disabled: true });
    const pager = elements<ComponentProps<typeof Pagination>>(tree, Pagination)[0].props;

    pager.onChange?.({} as React.ChangeEvent<unknown>, 2);
    expect(state.onPageChange).not.toHaveBeenCalled();
  });

  it.each(['light', 'dark'] as const)(
    'keeps semantic grouped headings, controls and horizontal scrolling in %s mode',
    (mode) => {
      const markup = renderToStaticMarkup(
        <ThemeProvider theme={createTheme({ palette: { mode } })}>
          <DataTableContainer>
            <table>
              <thead>
                <tr>
                  <th colSpan={2}>Criterios</th>
                </tr>
                <tr>
                  <th>Nombre</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Estudiante</td>
                  <td>
                    <input aria-label='Nota' defaultValue='80' />
                  </td>
                </tr>
              </tbody>
            </table>
          </DataTableContainer>
        </ThemeProvider>,
      );

      expect(markup).toContain('colSpan="2"');
      expect(markup).toContain('aria-label="Nota"');
      expect(markup).toContain('overflow-x:auto');
      expect(markup).toContain('padding-top:12px');
      expect(markup).toContain('padding-top:16px');
      expect(markup).toContain('padding-left:16px');
    },
  );
});
