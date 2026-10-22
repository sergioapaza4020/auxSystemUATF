import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hookHarness, elements } from '@/test-utils/hook-harness';
import { instance } from '@/api/config/config';
import { createRole, updateRole } from '@/api/roles.service';
import Form from '@/components/Form';
import { RoleEditDialog } from './RoleEditDialog';
import { RoleFields } from './RoleFields';
import { GroupedPermissionSelector } from './GroupedPermissionSelector';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/config/config', () => ({ instance: { post: vi.fn(), put: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(instance.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(instance.put).mockResolvedValue({ data: { data: {} } });
});
describe.each([false, true])('Role dialog (editing=%s)', (editing) => {
  it('keeps the existing permissionNames contract through RoleFields and saving', async () => {
    const initialValue = editing
      ? { name: 'CUSTOM', description: 'Existing', permissionNames: ['user.get-all', 'legacy.inactive'] }
      : undefined;

    const onSubmit = vi.fn(async (data: Parameters<typeof createRole>[0]) => {
      if (editing) await updateRole(7, data);
      else await createRole(data);
    });

    const h = hookHarness(() =>
      RoleEditDialog({
        open: true,
        initialValue,
        permissions: [{ idPermission: 1, name: 'user.get-all', description: 'Ver usuarios', isActive: true }],
        loadingPermissions: false,
        loading: false,
        onClose: vi.fn(),
        onSubmit,
      }),
    );

    const fields = () => elements<React.ComponentProps<typeof RoleFields>>(h.render(), RoleFields)[0].props;

    const selector = () =>
      elements<React.ComponentProps<typeof GroupedPermissionSelector>>(
        RoleFields(fields()),
        GroupedPermissionSelector,
      )[0].props;

    expect(selector().selectedPermissionNames).toEqual(initialValue?.permissionNames ?? []);
    if (!editing) fields().updateField('name', 'CUSTOM');
    const names = [...selector().selectedPermissionNames, 'attendance.session.create', 'attendance.save'];

    selector().onChange(names);
    const submit = elements<React.ComponentProps<typeof Form>>(h.render(), Form)[0].props.onSubmit;

    await submit?.({ preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>);
    const expected = { name: 'CUSTOM', description: editing ? 'Existing' : '', permissionNames: names };

    expect(onSubmit).toHaveBeenCalledWith(expected);
    if (editing) expect(instance.put).toHaveBeenCalledWith('/roles/7', expected);
    else expect(instance.post).toHaveBeenCalledWith('/roles', expected);
    expect(initialValue?.permissionNames).toEqual(editing ? ['user.get-all', 'legacy.inactive'] : undefined);
    h.unmount();
  });
});
