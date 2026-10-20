import type { PaginationMeta } from './apiResponse';

export interface ImportPreviewQuery {
  page: number;
  limit: number;
  search: string;
  status: 'all' | 'valid' | 'invalid';
}
export interface ImportPreviewPage<Row> {
  operationId: string;
  total: number;
  valid: number;
  invalid: number;
  data: Row[];
  meta: PaginationMeta;
}
