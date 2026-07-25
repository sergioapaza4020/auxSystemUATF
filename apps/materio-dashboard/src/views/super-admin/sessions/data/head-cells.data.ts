import type { HeadCell } from '@/components/table/types/headCell';
import type { ISession } from '@/interfaces/sessions/session.interface';

export const sessionHeadCellsData = [
  {
    id: 'idSession',
    label: '#',
    sortable: true,
  },
  {
    id: 'user',
    label: 'Usuario',
    sortable: true,
  },
  {
    id: 'browser',
    label: 'Navegador',
    sortable: true,
  },
  {
    id: 'os',
    label: 'Sistema Operativo',
    sortable: true,
  },
  {
    id: 'device',
    label: 'Dispositivo',
    sortable: true,
  },
  {
    id: 'ipAddress',
    label: 'Dirección IP',
    sortable: true,
  },
  {
    id: 'isActive',
    label: 'Estado',
    sortable: true,
  },
  {
    id: 'lastUsedAt',
    label: 'Última vez activo',
    sortable: true,
  },
  {
    id: 'actions',
    label: 'Acciones',
    sortable: false,
  },
] as const satisfies readonly HeadCell<ISession>[];
