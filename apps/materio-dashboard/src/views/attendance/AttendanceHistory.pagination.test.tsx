import type * as React from 'react';

import { describe, expect, it, vi } from 'vitest';
import { IconButton, MenuItem } from '@mui/material';

import { PaginationTable } from '@/components/table';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { AttendanceHistory } from './AttendanceHistory';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

describe('Attendance history remote controls', () => {
  it.each(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const)(
    'GEO %s never exposes manual date editing and limits deletion to clean drafts',
    (state) => {
      const harness = hookHarness(() =>
        AttendanceHistory({
          sessions: [
            {
              idAttendanceSession: 1,
              date: '2026-10-26',
              mode: 'GEOLOCATION',
              state,
              presentCount: 0,
              excusedCount: 0,
              absentCount: 0,
              totalStudents: 20,
              percentage: 0,
            },
          ],
          meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
          loading: false,
          selectedSessionId: null,
          onPageChange: vi.fn(),
          onLimitChange: vi.fn(),
          onSelectSession: vi.fn(),
          onEditDate: vi.fn(),
          onDeleteSession: vi.fn(),
        }),
      );

      const menu = elements<React.ComponentProps<typeof IconButton>>(harness.render(), IconButton).find(
        (item) => item.props['aria-haspopup'] === 'menu',
      );

      menu?.props.onClick?.({ currentTarget: {} } as React.MouseEvent<HTMLButtonElement>);

      const labels = elements<React.ComponentProps<typeof MenuItem>>(harness.render(), MenuItem).map(
        (item) => item.props.children,
      );

      expect(labels).not.toContain('Editar fecha');
      expect(labels.includes('Eliminar sesión')).toBe(state === 'DRAFT');
      harness.unmount();
    },
  );
  it('uses meta.total on page 2 and delegates page/limit to the parent', () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    const sessions = [1, 2].map((id) => ({
      idAttendanceSession: id,
      date: '2026-10-10',
      presentCount: 2,
      excusedCount: 1,
      absentCount: 3,
      totalStudents: 6,
      percentage: 41.667,
    }));

    const harness = hookHarness(() =>
      AttendanceHistory({
        sessions,
        meta: { page: 2, limit: 5, total: 43, totalPages: 9 },
        loading: false,
        selectedSessionId: null,
        onPageChange,
        onLimitChange,
        onSelectSession: vi.fn(),
      }),
    );

    const tree = harness.render();
    const pagination = elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

    expect(pagination.count).toBe(43);
    expect(pagination.page).toBe(1);
    pagination.onPageChange(null, 2);
    pagination.onRowsPerPageChange({ target: { value: '25' } } as React.ChangeEvent<HTMLInputElement>);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(onLimitChange).toHaveBeenCalledWith(25);
    const buttons = elements<{ 'aria-label'?: string }>(tree, IconButton);

    expect(buttons.filter((button) => button.props['aria-label']?.startsWith('Abrir sesión del'))).toHaveLength(2);
    harness.unmount();
  });
});
