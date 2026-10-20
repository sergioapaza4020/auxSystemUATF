import type { HeadCell } from '@/components/table/types/headCell';
import type { ISession } from '@/interfaces/sessions/session.interface';

export const sessionHeadCellsData = [
  {
    id: 'idSession',
    label: '#',
    sortable: false,
  },
  {
    id: 'user',
    label: 'Usuario',
    sortable: false,
  },
  {
    id: 'browser',
    label: 'Navegador',
    sortable: false,
  },
  {
    id: 'os',
    label: 'Sistema Operativo',
    sortable: false,
  },
  {
    id: 'device',
    label: 'Dispositivo',
    sortable: false,
  },
  {
    id: 'ipAddress',
    label: 'Dirección IP',
    sortable: false,
  },
  {
    id: 'isActive',
    label: 'Estado',
    sortable: false,
  },
  {
    id: 'lastUsedAt',
    label: 'Última vez activo',
    sortable: false,
  },
  {
    id: 'actions',
    label: 'Acciones',
    sortable: false,
  },
] as const satisfies readonly HeadCell<ISession>[];
