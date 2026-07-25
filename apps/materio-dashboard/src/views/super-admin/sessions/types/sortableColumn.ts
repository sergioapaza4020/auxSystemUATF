import type { SortableIds } from '@/utils/getSortableItems';
import type { sessionHeadCellsData } from '../data/head-cells.data';
import type { ISession } from '@/interfaces/sessions/session.interface';

export type SortableColumn = SortableIds<ISession, typeof sessionHeadCellsData>;
