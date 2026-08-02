import type { Order } from '../types/order';

export function compareByKey<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1;

  if (b[orderBy] > a[orderBy]) return 1;

  return 0;
}

export function getComparator<T>(order: Order, orderBy: keyof T) {
  return order === 'desc' ? (a: T, b: T) => compareByKey(a, b, orderBy) : (a: T, b: T) => -compareByKey(a, b, orderBy);
}
