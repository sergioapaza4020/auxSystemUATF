import type { RecordStatus } from './status-query.interface';

export interface CatalogPageQuery {
  page: number;
  limit: number;
  search: string;
  status: RecordStatus;
  sortBy?: 'idGradeScheme' | 'name' | 'isActive';
  sortOrder?: 'ASC' | 'DESC';
}
