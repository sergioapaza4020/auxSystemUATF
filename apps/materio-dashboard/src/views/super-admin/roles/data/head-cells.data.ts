import type { HeadCell } from '@/components/table';
import type { IRole } from '@/interfaces/roles/role.interface';

export const roleHeadCellsData = [
  {
    id: 'name',
    numeric: false,
    disablePadding: false,
    label: 'Nombre',
    sortable: true,
  },
  {
    id: 'description',
    numeric: false,
    disablePadding: false,
    label: 'Descripción',
    sortable: true,
  },
  {
    id: 'permissions',
    numeric: false,
    disablePadding: false,
    label: 'Permisos',
    sortable: false,
  },
  {
    id: 'isActive',
    numeric: false,
    disablePadding: false,
    label: 'Estado',
    sortable: true,
  },
  {
    id: 'actions',
    disablePadding: false,
    label: 'Acciones',
    sortable: false,
  },
] as const satisfies readonly HeadCell<IRole>[];
