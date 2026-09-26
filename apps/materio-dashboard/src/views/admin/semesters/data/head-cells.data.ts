import type { HeadCell } from '@/components/table';
import type { SemesterTableRecord } from '../components/SemesterRow';

export const semesterHeadCells = [
  { id: 'period', label: 'Período', disablePadding: false, sortable: true },
  { id: 'year', label: 'Año', disablePadding: false, sortable: true },
  { id: 'startDate', label: 'Fecha inicio', disablePadding: false, sortable: true },
  { id: 'endDate', label: 'Fecha fin', disablePadding: false, sortable: true },
  { id: 'current', label: 'Actual', disablePadding: false, sortable: false },
  { id: 'isActive', label: 'Estado', disablePadding: false, sortable: true },
  { id: 'actions', label: 'Acciones', disablePadding: false, sortable: false },
] as const satisfies readonly HeadCell<SemesterTableRecord>[];
