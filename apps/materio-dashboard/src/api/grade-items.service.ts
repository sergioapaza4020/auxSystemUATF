import { instance } from './config/config';

export const getGradeItems = async (): Promise<any> => {
  const gradeItems = await instance.get('/grade-items');

  return gradeItems.data.data;
};
