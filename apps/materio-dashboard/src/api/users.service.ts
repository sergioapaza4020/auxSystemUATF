import { instance } from './config/config';
import type { UserQuery } from '@/interfaces/users/user-query.interface';

export const getUsers = async (query?: UserQuery) => {
  const response = await instance.get('/users', {
    params: {
      ...query,
      role: query?.role?.join(','),
    },
  });

  return response.data.data;
};
