import { instance } from './config/config';

export const getGradeItems = async (): Promise<any> => {
  try {
    const gradeItems = await instance.get('/grade-items');

    return gradeItems.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};
