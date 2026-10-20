import type * as React from 'react';

import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '@mui/material';

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
