import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  downloadCareerStudentImportTemplate,
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

  it('accepts an invalid preview and resends the original file and target without manual multipart headers', async () => {
    const file = new File(['workbook'], 'students.xlsx');
    const preview = { total: 2, valid: 1, invalid: 1, rows: [] };
    const result = { imported: 2, total: 2, careerId: target };

    vi.mocked(instance.post)
      .mockResolvedValueOnce({ data: { status: true, data: preview } })
      .mockResolvedValueOnce({ data: { status: true, data: result } });
    expect(await previewCareerStudentImport(file, target)).toEqual(preview);
    expect(await importCareerStudents(file, target)).toEqual(result);

    for (const [index, endpoint] of ['/careers/12/students/import/preview', '/careers/12/students/import'].entries()) {
      const call = vi.mocked(instance.post).mock.calls[index];
      const body = call[1] as FormData;

      expect(call).toHaveLength(2);
      expect(call[0]).toBe(endpoint);
      expect(body.get('file')).toBe(file);
      expect([...body.keys()]).toEqual(['file']);
    }
  });

  it('propagates server failures and rejects unsuccessful response envelopes', async () => {
    const file = new File(['workbook'], 'students.xlsx');

    vi.mocked(instance.post)
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce({ data: { status: false, message: 'No se realizó ninguna asignación' } });
    await expect(importCareerStudents(file, target)).rejects.toThrow('Conflict');
    await expect(importCareerStudents(file, target)).rejects.toThrow('No se realizó ninguna asignación');
  });
});
