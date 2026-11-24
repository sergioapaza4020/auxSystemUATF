import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, TextField } from '@mui/material';

import { AttendanceManualContingencyDialog } from './AttendanceManualContingencyDialog';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import type { IAttendance, IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  saved: vi.fn(),
  close: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ saveAttendances: mocks.save, getAttendanceSession: mocks.get }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
const student = { idEnrollment: 10, user: { name: 'Ana', lastname: 'Perez' } } as IEnrollmentStudent;

const session: IAttendanceSession = {
  idAttendanceSession: 7,
  date: '2026-11-20',
  mode: 'GEOLOCATION_QR',
  state: 'OPEN',
  totalStudents: 1,
  presentCount: 0,
  excusedCount: 0,
  absentCount: 0,
  percentage: 0,
};

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue([]);
  mocks.saved.mockResolvedValue(undefined);
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.unstubAllGlobals();
});

function setup(existing?: IAttendance, current = session) {
  const h = hookHarness(() =>
    AttendanceManualContingencyDialog({
      session: current,
      student,
      existing,
      onClose: mocks.close,
      onSaved: mocks.saved,
    }),
  );

  cleanups.push(h.unmount);

  return h;
}

function button(tree: React.ReactNode, label: string) {
  const found = elements<React.ComponentProps<typeof Button>>(tree, Button).find(
    (item) => item.props.children === label,
  );

  if (!found) throw new Error(`Missing ${label}`);

  return found.props;
}

async function click(tree: React.ReactNode, label: string) {
  const props = button(tree, label);

  if (!props.disabled) await props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
}

function reason(tree: React.ReactNode, value = 'GPS sin respuesta verificado en aula') {
  elements<React.ComponentProps<typeof TextField>>(tree, TextField)
    .find((item) => item.props.multiline)
    ?.props.onChange?.({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
}

describe('individual audited contingency', () => {
  it.each([S.PRESENT, S.EXCUSED, S.ABSENT])('sends only the explicit %s record after confirmation', async (status) => {
    const h = setup();
    let tree = h.render();

    reason(tree);
    elements<React.ComponentProps<typeof TextField>>(tree, TextField)
      .find((item) => item.props.select)
      ?.props.onChange?.({ target: { value: status } } as React.ChangeEvent<HTMLInputElement>);
    tree = h.render();
    await click(tree, 'Revisar contingencia');
    expect(mocks.save).not.toHaveBeenCalled();
    await click(h.render(), 'Confirmar contingencia');
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(7, {
      attendances: [{ enrollmentId: 10, status, observation: 'GPS sin respuesta verificado en aula' }],
    });
    expect(mocks.saved).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it.each(['', '123456789', '\u200b'.repeat(20), 'a'.repeat(501)])('blocks invalid reason %j', (value) => {
    const h = setup();

    reason(h.render(), value);
    expect(button(h.render(), 'Revisar contingencia').disabled).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('requires a new reason when correcting a manual mark', () => {
    const h = setup({
      idAttendance: 1,
      enrollment: student,
      status: S.ABSENT,
      registrationMethod: 'MANUAL',
      observation: 'GPS sin respuesta verificado en aula',
    });

    reason(h.render());
    expect(button(h.render(), 'Revisar contingencia').disabled).toBe(true);
    reason(h.render(), 'Corrección de estudiante verificada presencialmente');
    expect(button(h.render(), 'Revisar contingencia').disabled).toBe(false);
  });
  it.each(['GEOLOCATION', 'QR', 'GEOLOCATION_QR'] as const)('does not permit replacing %s', (registrationMethod) => {
    const h = setup({ idAttendance: 1, enrollment: student, status: S.PRESENT, registrationMethod });

    reason(h.render());
    expect(button(h.render(), 'Revisar contingencia').disabled).toBe(true);
  });
  it.each(['DRAFT', 'SCHEDULED', 'CANCELLED'] as const)('does not permit contingency in %s', (state) => {
    const h = setup(undefined, { ...session, state });

    reason(h.render());
    expect(button(h.render(), 'Revisar contingencia').disabled).toBe(true);
  });
  it('serializes double clicks and reconciles a lost response without another POST', async () => {
    let reject!: (error: unknown) => void;

    mocks.save.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const h = setup();

    reason(h.render());
    await click(h.render(), 'Revisar contingencia');
    const tree = h.render();
    const first = click(tree, 'Confirmar contingencia');
    const second = click(tree, 'Confirmar contingencia');

    expect(mocks.save).toHaveBeenCalledOnce();
    reject(new Error('network'));
    await Promise.all([first, second]);
    expect(
      elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find((item) => item.props.multiline)
        ?.props.value,
    ).toBe('GPS sin respuesta verificado en aula');
    mocks.get.mockResolvedValue({
      attendances: [
        {
          enrollment: student,
          status: S.PRESENT,
          registrationMethod: 'MANUAL',
          observation: 'GPS sin respuesta verificado en aula',
        },
      ],
    });
    await click(h.render(), 'Consultar resultado');
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.saved).toHaveBeenCalledOnce();
  });
  it('does not announce success for an inconclusive reconciliation', async () => {
    mocks.save.mockRejectedValue(new Error('network'));
    const h = setup();

    reason(h.render());
    await click(h.render(), 'Revisar contingencia');
    await click(h.render(), 'Confirmar contingencia');
    mocks.get.mockResolvedValue({ attendances: [] });
    await click(h.render(), 'Consultar resultado');
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledOnce();
  });
});

it('ignores completion after the dialog unmounts', async () => {
  let resolve!: () => void;

  mocks.save.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const h = setup();

  reason(h.render());
  await click(h.render(), 'Revisar contingencia');
  const pending = click(h.render(), 'Confirmar contingencia');

  h.unmount();
  resolve();
  await pending;
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
});
it('retains the reason and reports an ownership rejection without claiming success', async () => {
  mocks.save.mockRejectedValue({
    isAxiosError: true,
    response: { status: 403, data: { code: 'MANUAL_OVERRIDE_FORBIDDEN', message: 'SQL secret' } },
  });
  const h = setup();

  reason(h.render());
  await click(h.render(), 'Revisar contingencia');
  await click(h.render(), 'Confirmar contingencia');
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(expect.not.stringContaining('secret'));
  expect(
    elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find((item) => item.props.multiline)?.props
      .value,
  ).toBe('GPS sin respuesta verificado en aula');
});
