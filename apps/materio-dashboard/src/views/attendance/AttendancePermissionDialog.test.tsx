import * as React from 'react';

import { Button, TextField } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendancePermissionDialog } from './AttendancePermissionDialog';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  saved: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@/api/assistant-grade-schemes.service', () => ({
  getMyAssistantGradeScheme: mocks.get,
  updateAssistantGradeScheme: mocks.update,
}));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(actual.useState) };
});
const actual = await vi.importActual<typeof React>('react');

function find(tree: React.ReactNode, type: unknown): React.ReactElement<Record<string, unknown>>[] {
  const result: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) result.push(child);
    result.push(...find(child.props.children as React.ReactNode, type));
  });

  return result;
}

function harness(value = '62.5', originalWeight = 0.5) {
  const slots: unknown[] = [value, false];

  return {
    slots,
    render() {
      let index = 0;

      vi.mocked(React.useState).mockImplementation(((initial?: unknown) => {
        const slot = index++;

        if (!(slot in slots)) slots[slot] = initial;

        return [
          slots[slot],
          (next: unknown) => {
            slots[slot] = next;
          },
        ];
      }) as unknown as typeof React.useState);

      try {
        return AttendancePermissionDialog({
          idCourse: 3,
          idEnrollment: 20,
          permissionWeight: originalWeight,
          onClose: mocks.close,
          onSaved: mocks.saved,
        });
      } finally {
        vi.mocked(React.useState).mockImplementation(actual.useState);
      }
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({
    idGradeScheme: 8,
    name: 'Esquema',
    description: 'Actual',
    assistantPercentage: 20,
    details: [
      {
        idGradeSchemeDetail: 1,
        percentage: 40,
        order: 1,
        gradeItem: { idGradeItem: 5, name: 'Asistencias' },
        permissionWeight: 0.5,
      },
      { idGradeSchemeDetail: 2, percentage: 60, order: 2, gradeItem: { idGradeItem: 6, name: 'Prácticas' } },
    ],
  });
  mocks.update.mockImplementation(
    (_id: number, data: { details: { gradeItem: { idGradeItem: number }; permissionWeight?: number }[] }) =>
      Promise.resolve({ ...data, idGradeScheme: 8 }),
  );
  mocks.saved.mockResolvedValue(undefined);
});
describe('Attendance permission editor', () => {
  it('converts percentage with the existing helper and preserves other scheme criteria', async () => {
    const h = harness();

    (find(h.render(), Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledWith(0.625));
    expect(mocks.get).toHaveBeenCalledWith(3, 20);
    expect(mocks.update).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        assistantPercentage: 20,
        details: [
          expect.objectContaining({ percentage: 40, permissionWeight: 0.625 }),
          expect.objectContaining({ percentage: 60, gradeItem: { idGradeItem: 6 } }),
        ],
      }),
    );
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it.each([
    ['0', 0],
    ['25', 0.25],
    ['33.3', 0.333],
    ['50', 0.5],
    ['50.5', 0.505],
    ['100', 1],
  ])('persists %s percent and uses the server-confirmed weight', async (value, weight) => {
    const h = harness(String(value), 0.1);

    (find(h.render(), Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledWith(weight));
    expect(h.slots[0]).toBe(String(value));
  });
  it('uses the confirmed response rather than the requested draft', async () => {
    mocks.update.mockResolvedValueOnce({ details: [{ gradeItem: { idGradeItem: 5 }, permissionWeight: 0.6 }] });
    const h = harness();

    (find(h.render(), Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledWith(0.6));
    expect(h.slots[0]).toBe('60');
  });
  it.each(['-1', '101', 'NaN', 'Infinity', ''])('rejects %s without sending a request', (value) => {
    const tree = harness(value).render();

    expect(find(tree, TextField)[0].props.error).toBe(true);
    expect(find(tree, Button)[1].props.disabled).toBe(true);
    (find(tree, Button)[1].props.onClick as () => void)();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('retains the entered value when updating fails', async () => {
    const h = harness();

    mocks.update.mockRejectedValueOnce(new Error('Offline'));
    (find(h.render(), Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(h.slots[0]).toBe('62.5');
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Offline'));
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it('shows the actual backend error while preserving the draft', async () => {
    mocks.update.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { message: 'No puedes editar este esquema.' } },
    });
    const h = harness();

    (find(h.render(), Button)[1].props.onClick as () => void)();
    await vi.waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('No puedes editar este esquema.')),
    );
    expect(h.slots[0]).toBe('62.5');
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
