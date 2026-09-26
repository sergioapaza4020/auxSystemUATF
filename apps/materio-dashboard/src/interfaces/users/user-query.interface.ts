import type { RecordStatus } from '../status-query.interface';

export interface UserQuery {
  careerId?: number;
  search?: string;
  role?: string[];
  status?: RecordStatus;
  page?: number;
  limit?: number;
}
