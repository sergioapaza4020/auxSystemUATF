import type { ICourse } from '@/interfaces/courses/course.interface';
import { instance } from './config/config';

export const getCourses = async (): Promise<ICourse[]> => {
  const courses = await instance.get('/courses');

  return courses.data.data;
};
