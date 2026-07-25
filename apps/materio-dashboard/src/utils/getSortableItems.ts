import type { HeadCell } from '@/components/table/types/headCell';

export type SortableIds<TEntity, T extends readonly HeadCell<TEntity>[]> = Extract<T[number], { sortable: true }>['id'];
