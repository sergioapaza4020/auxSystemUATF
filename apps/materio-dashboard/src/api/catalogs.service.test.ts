import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import {
  createSemester,
  deactivateSemester,
  getCurrentSemester,
  getSemesters,
  reactivateSemester,
  updateSemester,
} from './semesters.service';
import {
  createGradeItem,
  deactivateGradeItem,
  getGradeItems,
  reactivateGradeItem,
  updateGradeItem,
} from './grade-items.service';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe('Administrative catalog API contracts', () => {
  it('requests inactive records through the existing status filter and unwraps data', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [{ idSemester: 1 }] } });
    expect(await getSemesters('all')).toEqual([{ idSemester: 1 }]);
    expect(instance.get).toHaveBeenCalledWith('/semesters', { params: { status: 'all' } });
    await getGradeItems('all');
    expect(instance.get).toHaveBeenCalledWith('/grade-items', { params: { status: 'all' } });
    await getGradeItems();
    expect(instance.get).toHaveBeenCalledWith('/grade-items', { params: { status: undefined } });
  });

  it('keeps current-semester selection on the authoritative contextual endpoint', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: { idSemester: 2 } } });
    expect(await getCurrentSemester()).toEqual({ idSemester: 2 });
    expect(instance.get).toHaveBeenCalledWith('/semesters/current');
  });

  it('uses the controller methods for semester mutations', async () => {
    const data = {
      year: 2026,
      period: 'II' as const,
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    };

    await createSemester(data);
    await updateSemester(7, data);
    await deactivateSemester(7);
    await reactivateSemester(7);
    expect(instance.post).toHaveBeenCalledWith('/semesters', data);
    expect(instance.patch).toHaveBeenCalledWith('/semesters/7', data);
    expect(instance.delete).toHaveBeenCalledWith('/semesters/7');
    expect(instance.patch).toHaveBeenCalledWith('/semesters/reactivate/7');
  });

  it('uses PATCH for item editing and reactivation and surfaces HTTP failures', async () => {
    const data = { name: 'Prácticas' };

    await createGradeItem(data);
    await updateGradeItem(3, data);
    await deactivateGradeItem(3);
    await reactivateGradeItem(3);
    expect(instance.post).toHaveBeenCalledWith('/grade-items', data);
    expect(instance.patch).toHaveBeenCalledWith('/grade-items/3', data);
    expect(instance.delete).toHaveBeenCalledWith('/grade-items/3');
    expect(instance.patch).toHaveBeenCalledWith('/grade-items/reactivate/3');
    vi.mocked(instance.patch).mockRejectedValueOnce(new Error('Conflict'));
    await expect(updateGradeItem(3, data)).rejects.toThrow('Conflict');
  });
});
