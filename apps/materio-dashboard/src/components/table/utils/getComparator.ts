import type { ISession } from '@/interfaces/sessions/session.interface';
import type { Order } from '../types/order';
import type { SortableColumn } from '../types/sortableColumn';

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1;

  if (b[orderBy] > a[orderBy]) return 1;

  return 0;
}

export function getComparator(order: Order, orderBy: SortableColumn) {
  return order === 'desc'
    ? (a: ISession, b: ISession) => descendingComparator(a, b, orderBy)
    : (a: ISession, b: ISession) => -descendingComparator(a, b, orderBy);
}
