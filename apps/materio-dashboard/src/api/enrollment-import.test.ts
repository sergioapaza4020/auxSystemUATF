import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  downloadEnrollmentImportTemplate,
  getEnrollmentImportPreviewPage,
  importEnrollments,
  previewEnrollmentImport,
} from './enrollments.service';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('Enrollment import API', () => {
  const target = { courseId: 12, semesterId: 25 };

  it('downloads the template for the exact course and semester', async () => {
    const blob = new Blob(['template']);

    vi.mocked(instance.get).mockResolvedValue({ data: blob });
    expect(await downloadEnrollmentImportTemplate(target)).toBe(blob);
    expect(instance.get).toHaveBeenCalledWith('/enrollments/import/template', { params: target, responseType: 'blob' });
  });

  it('uploads the file only for preview and confirms using only operationId', async () => {
    const file = new File(['workbook'], 'students.xlsx');

    const preview = {
      operationId: 'operation-id',
      total: 10000,
      valid: 9999,
      invalid: 1,
      data: Array.from({ length: 25 }, (_, i) => ({ row: i + 2 })),
      meta: { page: 1, limit: 25, total: 10000, totalPages: 400 },
    };

    const result = { imported: 2, total: 2, ...target };

    vi.mocked(instance.post)
      .mockResolvedValueOnce({ data: { status: true, data: preview } })
      .mockResolvedValueOnce({ data: { status: true, data: result } });
    expect(await previewEnrollmentImport(file, target)).toEqual(preview);
    expect(await importEnrollments('operation-id')).toEqual(result);

    const previewBody = vi.mocked(instance.post).mock.calls[0][1] as FormData;

    expect(previewBody.get('file')).toBe(file);
    expect(previewBody.get('courseId')).toBe('12');
    expect(previewBody.get('semesterId')).toBe('25');
    expect(instance.post).toHaveBeenLastCalledWith('/enrollments/import', { operationId: 'operation-id' });
  });

  it('propagates server failures and rejects unsuccessful response envelopes', async () => {
    vi.mocked(instance.post)
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce({ data: { status: false, message: 'No se creó ninguna matrícula' } });
    await expect(importEnrollments('operation-id')).rejects.toThrow('Conflict');
    await expect(importEnrollments('operation-id')).rejects.toThrow('No se creó ninguna matrícula');
  });
});

it('loads remote rows with query and cancellation instead of uploading the workbook again', async () => {
  const controller = new AbortController();
  const query = { page: 2, limit: 50, search: 'Ana', status: 'invalid' as const };

  const preview = {
    operationId: 'operation-id',
    total: 10000,
    valid: 9999,
    invalid: 1,
    data: [],
    meta: { page: 2, limit: 50, total: 1, totalPages: 1 },
  };

  vi.mocked(instance.get).mockResolvedValue({ data: { status: true, data: preview } });
  expect(await getEnrollmentImportPreviewPage('operation-id', query, controller.signal)).toEqual(preview);
  expect(instance.get).toHaveBeenCalledWith('/enrollments/import/preview/operation-id', {
    params: query,
    signal: controller.signal,
  });
  expect(instance.post).not.toHaveBeenCalled();
});
