import type { Order } from '../types/order';

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1;

  if (b[orderBy] > a[orderBy]) return 1;

  return 0;
}

export function getComparator<T>(order: Order, orderBy: keyof T) {
  return order === 'desc'
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy);
}
