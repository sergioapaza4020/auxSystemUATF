import type { HeadCell } from '@/components/table/types/headCell';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

export const gradeSchemeHeadCellsData = [
  {
    id: 'idGradeScheme',
    label: '#',
    sortable: true,
  },
  {
    id: 'name',
    label: 'Nombre',
    sortable: true,
  },
  {
    id: 'description',
    label: 'Descripción',
    sortable: false,
  },
  {
    id: 'details',
    label: 'Detalles',
    sortable: false,
  },
  {
    id: 'isActive',
    label: 'Estado',
    sortable: true,
  },
  {
    id: 'actions',
    label: 'Acciones',
    sortable: false,
  },
] as const satisfies readonly HeadCell<IGradeScheme>[];
