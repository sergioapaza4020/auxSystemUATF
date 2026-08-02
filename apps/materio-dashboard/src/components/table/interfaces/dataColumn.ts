export interface DataColumn<T> {
  id: Extract<keyof T, string>;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  disablePadding?: boolean;
  numeric?: boolean;
}
