import type { HeadCell } from '@/components/table';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

export const gradeItemHeadCells = [
  { id: 'name', label: 'Nombre', disablePadding: false, sortable: true },
  { id: 'isActive', label: 'Estado', disablePadding: false, sortable: true },
  { id: 'actions', label: 'Acciones', disablePadding: false, sortable: false },
] as const satisfies readonly HeadCell<IGradeItem>[];
