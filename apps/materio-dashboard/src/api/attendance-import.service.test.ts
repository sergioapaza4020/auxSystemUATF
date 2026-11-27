import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { confirmAttendanceImport, previewAttendanceImport } from './attendance-import.service';

vi.mock('./config/config', () => ({ instance: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('API de importación de asistencia', () => {
  it('envía el Excel y la selección de sesión en multipart', async () => {
    vi.mocked(instance.post).mockResolvedValue({ data: { status: true, data: { operationId: null } } });

    const file = new File(['xlsx'], 'asistencia.xlsx');
    const options = [{ column: 'B', sessionId: 'create' as const }];

    await expect(previewAttendanceImport(1, file, options, false)).resolves.toEqual({ operationId: null });

    const [url, payload] = vi.mocked(instance.post).mock.calls[0];

    expect(url).toBe('/attendances/import/1/preview');
    expect((payload as FormData).get('file')).toEqual(file);
    expect((payload as FormData).get('options')).toBe(JSON.stringify({ choices: options, updateExisting: false }));
  });

  it('propaga un rechazo de confirmación', async () => {
    vi.mocked(instance.post).mockResolvedValue({ data: { status: false, message: 'Genera una nueva vista previa' } });
    await expect(confirmAttendanceImport(1, 'operation')).rejects.toThrow('Genera una nueva vista previa');
  });
});
