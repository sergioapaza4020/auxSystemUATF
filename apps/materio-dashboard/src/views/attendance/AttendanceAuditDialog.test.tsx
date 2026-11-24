import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, TableRow } from '@mui/material';

import { AttendanceAuditDialog } from './AttendanceAuditDialog';
import { PaginationTable } from '@/components/table';
import { getAttendanceAudit } from '@/api/attendances.service';
import { elements, hookHarness, deferred } from '@/test-utils/hook-harness';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { IAttendanceAuditEvent } from '@/interfaces/attendances/attendance.interface';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';

const mocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ getAttendanceAudit: vi.fn() }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
const get = vi.mocked(getAttendanceAudit);

const event: IAttendanceAuditEvent = {
  idAttendanceAuditEvent: 1,
  idEnrollment: 10,
  idActor: 4,
  operation: 'UPDATE',
  occurredAt: '2026-11-20T14:00:00Z',
  previousStatus: S.ABSENT,
  newStatus: S.PRESENT,
  previousRegistrationMethod: 'MANUAL',
  newRegistrationMethod: 'MANUAL',
  previousObservation: 'Motivo anterior verificado',
  newObservation: 'Corrección presencial verificada',
  sessionStateAtOperation: 'CLOSED',
};

const response = (events = [event]): PaginatedApiResponse<IAttendanceAuditEvent[]> => ({
  status: true,
  statusCode: 200,
  data: events,
  meta: { page: 1, limit: 10, total: 25, totalPages: 3 },
});

const cleanups: (() => void)[] = [];

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(response());
});
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
describe('read-only attendance audit', () => {
  it('uses actual page/limit and approved IDs and snapshots', async () => {
    const h = hookHarness(() => AttendanceAuditDialog({ idSession: 7, onClose: vi.fn() }));

    cleanups.push(h.unmount);
    h.render();
    await flush();
    const tree = h.render();

    expect(get).toHaveBeenCalledWith(7, { page: 1, limit: 10 }, expect.any(AbortSignal));
    expect(elements(tree, TableRow)).toHaveLength(2);
    const pagination = elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

    expect(pagination.count).toBe(25);
    pagination.onPageChange?.(null, 1);
    h.render();
    await flush();
    expect(get).toHaveBeenLastCalledWith(7, { page: 2, limit: 10 }, expect.any(AbortSignal));
  });
  it.each([403, 404])('shows a safe %s error without leaking the body', async (status) => {
    get.mockRejectedValue({ isAxiosError: true, response: { status, data: { message: 'SQL token secret' } } });
    const h = hookHarness(() => AttendanceAuditDialog({ idSession: 7, onClose: vi.fn() }));

    cleanups.push(h.unmount);
    h.render();
    await flush();
    const alerts = elements<React.ComponentProps<typeof Alert>>(h.render(), Alert);

    expect(alerts).toHaveLength(1);
    expect(String(alerts[0].props.children)).not.toContain('secret');
    expect(mocks.error).toHaveBeenCalledOnce();
  });
  it('aborts stale session reads and ignores late responses', async () => {
    const old = deferred<PaginatedApiResponse<IAttendanceAuditEvent[]>>();

    get.mockReturnValueOnce(old.promise);
    let id = 7;
    const h = hookHarness(() => AttendanceAuditDialog({ idSession: id, onClose: vi.fn() }));

    cleanups.push(h.unmount);
    h.render();
    const signal = get.mock.calls[0][2];

    id = 8;
    h.render();
    await flush();
    expect(signal?.aborted).toBe(true);
    old.resolve(response([]));
    await flush();
    expect(elements(h.render(), TableRow)).toHaveLength(2);
  });
});
