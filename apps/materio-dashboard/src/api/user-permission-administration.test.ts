import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  addUserRoles,
  createUser,
  deactivateUser,
  getUserById,
  getUsersPage,
  reactivateUser,
  updateUser,
} from './users.service';
import {
  createPermission,
  deactivatePermission,
  getPermissions,
  reactivatePermission,
  updatePermission,
} from './permissions.service';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('Remote users API', () => {
  it('preserves server metadata, requests only one page, and passes cancellation', async () => {
    const controller = new AbortController();

    const envelope = {
      status: true,
      statusCode: 200,
      data: [{ idUser: 101 }],
      meta: { page: 5, limit: 25, total: 2300, totalPages: 92 },
    };

    vi.mocked(instance.get).mockResolvedValue({ data: envelope });
    expect(
      await getUsersPage(
        { page: 5, limit: 25, search: 'ana', status: 'inactive', role: ['STUDENT', 'ASSISTANT'] },
        controller.signal,
      ),
    ).toEqual(envelope);
    expect(instance.get).toHaveBeenCalledTimes(1);
    expect(instance.get).toHaveBeenCalledWith('/users', {
      params: { page: 5, limit: 25, search: 'ana', status: 'inactive', role: 'STUDENT,ASSISTANT' },
      signal: controller.signal,
    });
  });

  it('does not send an empty role CSV, which ValidationPipe rejects', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [], meta: {} } });
    await getUsersPage({ role: [] });
    expect(instance.get).toHaveBeenCalledWith('/users', { params: { role: undefined }, signal: undefined });
  });

  it('uses actual detail and mutation endpoints', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: { idUser: 3 } } });
    expect(await getUserById(3)).toEqual({ idUser: 3 });

    const data = {
      name: 'Ana',
      lastname: 'Pérez',
      username: 'ana',
      email: 'ana@example.com',
      ci: '123',
      ru: '456',
      password: 'new-secret',
      roleNames: ['STUDENT'],
    };

    await createUser(data);
    await updateUser(3, { name: 'Ana María' });
    await addUserRoles(3, ['ASSISTANT']);
    await deactivateUser(3);
    await reactivateUser(3);
    expect(instance.post).toHaveBeenCalledWith('/users', data);
    expect(instance.patch).toHaveBeenCalledWith('/users/3', { name: 'Ana María' });
    expect(instance.patch).toHaveBeenCalledWith('/users/assign-roles/3', { roleNames: ['ASSISTANT'] });
    expect(instance.delete).toHaveBeenCalledWith('/users/3');
    expect(instance.patch).toHaveBeenCalledWith('/users/reactivate/3');
  });
});

describe('Permission catalog API', () => {
  it('loads all states without changing the Roles assignment API', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [] } });
    await getPermissions('all');
    expect(instance.get).toHaveBeenCalledWith('/permissions', { params: { status: 'all' } });
  });

  it('never sends a key rename, even if an object contains extra fields', async () => {
    const value = { name: 'renamed.unsafe', description: ' Nueva descripción ' };

    await updatePermission(7, value);
    expect(instance.patch).toHaveBeenCalledWith('/permissions/7', { description: 'Nueva descripción' });
  });

  it('uses the existing create, deactivate and reactivate methods', async () => {
    await createPermission({ name: 'user.export', description: 'Exportar' });
    await deactivatePermission(7);
    await reactivatePermission(7);
    expect(instance.post).toHaveBeenCalledWith('/permissions', { name: 'user.export', description: 'Exportar' });
    expect(instance.delete).toHaveBeenCalledWith('/permissions/7');
    expect(instance.patch).toHaveBeenCalledWith('/permissions/reactivate/7');
  });
});
