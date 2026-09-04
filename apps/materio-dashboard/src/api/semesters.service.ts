import type { ISemester } from '@/interfaces/semesters/semester.interface';
import { instance } from './config/config';

export const getCurrentSemester = async (): Promise<ISemester> => {
  const response = await instance.get('/semesters/current');

  return response.data.data;
};
