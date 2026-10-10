import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { getGradeMatrix, saveActivityGrades } from './grade-matrix.service';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), patch: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Aggregated matrix requests', () => {
  it.each([2, 50, 150])('loads %s students with one HTTP call', async (count) => {
    vi.mocked(instance.get).mockResolvedValue({
      data: {
        status: true,
        data: { students: Array.from({ length: count }, (_, index) => ({ idEnrollment: index })) },
      },
    });
    expect((await getGradeMatrix(1, 4)).students).toHaveLength(count);
    expect(instance.get).toHaveBeenCalledTimes(1);
    expect(instance.get).toHaveBeenCalledWith('/grades/matrix/1', { params: { detailId: 4 }, signal: undefined });
  });
  it('saves a mixed changed-cell payload in one request and adopts server scores', async () => {
    const changes = [
      { enrollmentId: 100, activityId: 10, score: 85.555 },
      { enrollmentId: 101, activityId: 11, score: 0 },
    ];

    vi.mocked(instance.patch).mockResolvedValue({
      data: {
        status: true,
        data: {
          grades: [
            { idGrade: 1, ...changes[0], score: 85.56 },
            { idGrade: 2, ...changes[1] },
          ],
        },
      },
    });
    expect((await saveActivityGrades(1, changes))[0].score).toBe(85.56);
    expect(instance.patch).toHaveBeenCalledTimes(1);
    expect(instance.patch).toHaveBeenCalledWith('/grades/bulk/1', { grades: changes });
  });
  it('surfaces unsuccessful envelopes instead of clearing dirty state on false success', async () => {
    vi.mocked(instance.patch).mockResolvedValue({
      data: { status: false, message: 'La actividad ya no está activa.' },
    });
    await expect(saveActivityGrades(1, [{ enrollmentId: 100, activityId: 10, score: 85 }])).rejects.toThrow(
      'La actividad ya no está activa.',
    );
  });
});
