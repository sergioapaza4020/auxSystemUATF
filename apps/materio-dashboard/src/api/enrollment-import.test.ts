import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { downloadEnrollmentImportTemplate, importEnrollments, previewEnrollmentImport } from './enrollments.service';

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

  it('accepts an invalid preview and resends the original file and target without manual multipart headers', async () => {
    const file = new File(['workbook'], 'students.xlsx');
    const preview = { total: 2, valid: 1, invalid: 1, rows: [] };
    const result = { imported: 2, total: 2, ...target };

    vi.mocked(instance.post)
      .mockResolvedValueOnce({ data: { status: true, data: preview } })
      .mockResolvedValueOnce({ data: { status: true, data: result } });
    expect(await previewEnrollmentImport(file, target)).toEqual(preview);
    expect(await importEnrollments(file, target)).toEqual(result);

    for (const [index, endpoint] of ['/enrollments/import/preview', '/enrollments/import'].entries()) {
      const call = vi.mocked(instance.post).mock.calls[index];
      const body = call[1] as FormData;

      expect(call).toHaveLength(2);
      expect(call[0]).toBe(endpoint);
      expect(body.get('file')).toBe(file);
      expect(body.get('courseId')).toBe('12');
      expect(body.get('semesterId')).toBe('25');
      expect([...body.keys()]).toEqual(['file', 'courseId', 'semesterId']);
    }
  });

  it('propagates server failures and rejects unsuccessful response envelopes', async () => {
    const file = new File(['workbook'], 'students.xlsx');

    vi.mocked(instance.post)
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce({ data: { status: false, message: 'No se creó ninguna matrícula' } });
    await expect(importEnrollments(file, target)).rejects.toThrow('Conflict');
    await expect(importEnrollments(file, target)).rejects.toThrow('No se creó ninguna matrícula');
  });
});
