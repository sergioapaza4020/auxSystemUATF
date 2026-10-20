import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  downloadCareerStudentImportTemplate,
  getCareerStudentImportPreviewPage,
  importCareerStudents,
  previewCareerStudentImport,
} from './careers.service';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('Career student import API', () => {
  const target = 12;

  it('downloads the template for the selected career', async () => {
    const blob = new Blob(['template']);

    vi.mocked(instance.get).mockResolvedValue({ data: blob });
    expect(await downloadCareerStudentImportTemplate(target)).toBe(blob);
    expect(instance.get).toHaveBeenCalledWith('/careers/12/students/import/template', { responseType: 'blob' });
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

    const result = { imported: 2, total: 2, careerId: target };

    vi.mocked(instance.post)
      .mockResolvedValueOnce({ data: { status: true, data: preview } })
      .mockResolvedValueOnce({ data: { status: true, data: result } });
    expect(await previewCareerStudentImport(file, target)).toEqual(preview);
    expect(await importCareerStudents('operation-id', target)).toEqual(result);

    const previewBody = vi.mocked(instance.post).mock.calls[0][1] as FormData;

    expect(previewBody.get('file')).toBe(file);
    expect([...previewBody.keys()]).toEqual(['file']);
    expect(instance.post).toHaveBeenLastCalledWith('/careers/12/students/import', { operationId: 'operation-id' });
  });

  it('propagates server failures and rejects unsuccessful response envelopes', async () => {
    vi.mocked(instance.post)
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce({ data: { status: false, message: 'No se realizó ninguna asignación' } });
    await expect(importCareerStudents('operation-id', target)).rejects.toThrow('Conflict');
    await expect(importCareerStudents('operation-id', target)).rejects.toThrow('No se realizó ninguna asignación');
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
  expect(await getCareerStudentImportPreviewPage(12, 'operation-id', query, controller.signal)).toEqual(preview);
  expect(instance.get).toHaveBeenCalledWith('/careers/12/students/import/preview/operation-id', {
    params: query,
    signal: controller.signal,
  });
  expect(instance.post).not.toHaveBeenCalled();
});
