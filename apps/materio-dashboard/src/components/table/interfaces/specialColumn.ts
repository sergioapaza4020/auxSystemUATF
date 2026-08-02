import type { SpecialColumnId } from '../types/specialColumnId';

export interface SpecialColumn {
  id: SpecialColumnId;
  label: string;
  sortable?: false;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  disablePadding?: boolean;
}
