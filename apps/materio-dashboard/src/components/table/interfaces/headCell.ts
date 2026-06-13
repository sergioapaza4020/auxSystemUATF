import type { ColumnId } from '../types/columnId';

export interface HeadCell {
  id: ColumnId;
  label: string;
  sortable: boolean;
}
