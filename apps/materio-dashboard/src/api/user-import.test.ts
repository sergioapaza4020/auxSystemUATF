import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  downloadUserImportTemplate,
  getUserImportPreviewPage,
  confirmUserImport,
  getUserImportStatus,
  previewUserImport,
} from './users.service';
import type { IUserImportPreview, UserImportPreviewQuery } from '@/interfaces/users/user-import.interface';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('User import API', () => {
  it('downloads the template for the selected role as a blob', async () => {
    const blob = new Blob(['template']);

    vi.mocked(instance.get).mockResolvedValue({ data: blob });
    expect(await downloadUserImportTemplate('DIRECTOR')).toBe(blob);
    expect(instance.get).toHaveBeenCalledWith('/users/import/template', {
      params: { roleName: 'DIRECTOR' },
      responseType: 'blob',
    });
  });

  it('uploads Excel only for preview; confirms with operationId and no body', async () => {
    const file = new File(['workbook'], 'users.xlsx');

    vi.mocked(instance.post).mockResolvedValue({ data: { data: { operationId: 'op' } } });
    await previewUserImport(file, 'TEACHER');
    const [url, body] = vi.mocked(instance.post).mock.calls[0];

    expect(url).toBe('/users/import/preview');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    await confirmUserImport('op');
    expect(instance.post).toHaveBeenLastCalledWith('/users/import/op/confirm');
  });

  it('gets durable status with cancellation and propagates confirm errors', async () => {
    const controller = new AbortController();

    vi.mocked(instance.get).mockResolvedValue({ data: { data: { progress: 75 } } });
    expect(await getUserImportStatus('op', controller.signal)).toEqual({ progress: 75 });
    expect(instance.get).toHaveBeenCalledWith('/users/import/op/status', { signal: controller.signal });
    vi.mocked(instance.post).mockRejectedValue(new Error('Unavailable'));
    await expect(confirmUserImport('op')).rejects.toThrow('Unavailable');
  });

  it.each<Partial<UserImportPreviewQuery>>([
    { page: 2 },
    { status: 'invalid' },
    { status: 'valid' },
    { search: ' Ana Pérez ' },
    { limit: 50 },
    { limit: 100 },
  ])('requests remote preview pages and filters %j with cancellation', async (patch) => {
    const query: UserImportPreviewQuery = { page: 1, limit: 25, status: 'all', search: '', ...patch };

    const preview: IUserImportPreview = {
      operationId: 'operation-id',
      total: 61,
      valid: 60,
      invalid: 1,
      data: [],
      meta: { page: query.page, limit: query.limit, total: 1, totalPages: 1 },
    };

    const controller = new AbortController();

    vi.mocked(instance.get).mockResolvedValue({ data: { status: true, data: preview } });
    expect(await getUserImportPreviewPage(preview.operationId, query, controller.signal)).toEqual(preview);
    expect(instance.get).toHaveBeenCalledWith('/users/import/preview/operation-id', {
      params: { ...query, search: query.search.trim() || undefined },
      signal: controller.signal,
    });
    expect(instance.post).not.toHaveBeenCalled();
    controller.abort();
  });
});
