import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { getCoursesPage } from './courses.service';
import {
  getGradeSchemesPage,
  getGradeSchemeById,
  createGradeScheme,
  updateGradeScheme,
  deleteGradeScheme,
  reactivateGradeScheme,
} from './grade-scheme.service';
import { getMyEnrollments } from './enrollments.service';
import { getCareerById } from './careers.service';

vi.mock('./config/config', () => ({
  instance: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());
describe('Phase 5 API contracts', () => {
  it.each([
    { path: '/courses', read: getCoursesPage },
    {
      path: '/grade-schemes',
      read: getGradeSchemesPage,
    },
  ])('retains the paginated envelope for $path', async ({ path, read }) => {
    const data = { status: true, data: [], meta: { page: 2, limit: 5, total: 31, totalPages: 7 } };

    vi.mocked(instance.get).mockResolvedValue({ data });
    const query = { page: 2, limit: 5, search: 'Ana', status: 'all' as const };
    const controller = new AbortController();

    expect(await read(query, controller.signal)).toEqual(data);
    expect(instance.get).toHaveBeenCalledWith(path, { params: query, signal: controller.signal });
  });
  it('requests the current semester and a light representation for Principal', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [{ idEnrollment: 1 }] } });
    const controller = new AbortController();

    expect(await getMyEnrollments(controller.signal)).toEqual([{ idEnrollment: 1 }]);
    expect(instance.get).toHaveBeenCalledWith('/enrollments/my-enrollments', {
      params: { current: true },
      signal: controller.signal,
    });
  });
  it('requests one career without downloading a full catalog or changing permissions', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [{ idCareer: 7, isActive: false }] } });
    const controller = new AbortController();

    expect(await getCareerById(7, controller.signal)).toEqual({ idCareer: 7, isActive: false });
    expect(instance.get).toHaveBeenCalledWith('/careers', {
      params: { idCareer: 7, status: 'all' },
      signal: controller.signal,
    });
    vi.mocked(instance.get).mockResolvedValue({ data: { data: [] } });
    expect(await getCareerById(99)).toBeNull();
  });
  it('retains global scheme detail and CRUD contracts independently of the paginated list', async () => {
    const dto = { name: 'Esquema', description: 'Descripción', details: [] };

    vi.mocked(instance.get).mockResolvedValue({ data: { data: { idGradeScheme: 7, ...dto } } });
    vi.mocked(instance.post).mockResolvedValue({ data: { data: { idGradeScheme: 7, ...dto } } });
    vi.mocked(instance.patch).mockResolvedValue({ data: { data: { idGradeScheme: 7, ...dto } } });
    expect(await getGradeSchemeById(7)).toMatchObject({ idGradeScheme: 7 });
    expect(instance.get).toHaveBeenLastCalledWith('/grade-schemes/id/7');
    await createGradeScheme(dto);
    expect(instance.post).toHaveBeenCalledWith('/grade-schemes', dto);
    await updateGradeScheme(7, dto);
    expect(instance.put).toHaveBeenCalledWith('/grade-schemes/update/7', dto);
    await deleteGradeScheme(7);
    expect(instance.delete).toHaveBeenCalledWith('/grade-schemes/7');
    await reactivateGradeScheme(7);
    expect(instance.patch).toHaveBeenCalledWith('/grade-schemes/reactivate/7');
  });
});
