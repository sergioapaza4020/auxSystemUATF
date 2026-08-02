import type { HeadCell } from '@/components/table/types/headCell';

export type SortableIds<TEntity, TColumns extends readonly HeadCell<TEntity>[]> = Extract<
  TColumns[number],
  { sortable: true }
>['id'];
