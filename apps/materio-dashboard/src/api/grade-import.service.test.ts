import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { confirmGradeImport, previewGradeImport } from './grade-import.service';

vi.mock('./config/config', () => ({ instance: { post: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe('API de importación de calificaciones', () => {
  it('envía el archivo y la resolución de columnas en multipart con omisión predeterminada', async () => {
    vi.mocked(instance.post).mockResolvedValue({ data: { status: true, data: { operationId: null } } });

    const file = new File(['xlsx'], 'notas.xlsx');
    const choices = [{ column: 'B', activityId: 25, acceptDate: true }];

    await expect(previewGradeImport(12, file, choices, false)).resolves.toEqual({ operationId: null });

    const [url, body] = vi.mocked(instance.post).mock.calls[0];

    expect(url).toBe('/grades/import/12/preview');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toEqual(file);
    expect((body as FormData).get('options')).toBe(JSON.stringify({ choices, updateExisting: false }));
  });

  it('confirma por identificador y devuelve el resumen real', async () => {
    const result = { created: 2, updated: 1, skipped: 0, empty: 2 };

    vi.mocked(instance.post).mockResolvedValue({ data: { status: true, data: result } });
    await expect(confirmGradeImport(12, 'preview-id')).resolves.toEqual(result);
    expect(instance.post).toHaveBeenCalledWith('/grades/import/12/preview-id/confirm');
  });

  it('propaga un rechazo de confirmación', async () => {
    vi.mocked(instance.post).mockResolvedValue({ data: { status: false, message: 'La vista previa venció' } });
    await expect(confirmGradeImport(12, 'preview-id')).rejects.toThrow('La vista previa venció');
  });
});
