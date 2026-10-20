import type { CatalogPageQuery } from '@/interfaces/catalog-page.interface';
import type { PaginatedApiResponse, ApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type { ICourse, ICourseWrite } from '@/interfaces/courses/course.interface';
import { instance } from './config/config';

export const getCourses = async (status?: RecordStatus): Promise<ICourse[]> => {
  const courses = await instance.get<ApiResponse<ICourse[]>>('/courses', { params: { status } });

  return courses.data.data;
};

export const createCourse = async (data: ICourseWrite): Promise<void> => {
  await instance.post('/courses', data);
};

export const updateCourse = async (id: number, data: ICourseWrite): Promise<void> => {
  await instance.patch(`/courses/${id}`, data);
};

export const deactivateCourse = async (id: number): Promise<void> => {
  await instance.delete(`/courses/${id}`);
};

export const reactivateCourse = async (id: number): Promise<void> => {
  await instance.patch(`/courses/reactivate/${id}`);
};

export const getCoursesPage = async (query: CatalogPageQuery, signal?: AbortSignal) =>
  (await instance.get<PaginatedApiResponse<ICourse[]>>('/courses', { params: query, signal })).data;
