import type { UserRole } from '@/enums/userRole';

export interface UserQuery {
  careerId?: number;
  search?: string;
  role?: UserRole[];
  page?: number;
  limit?: number;
}
