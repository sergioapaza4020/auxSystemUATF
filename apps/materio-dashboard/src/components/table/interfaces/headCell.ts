export interface IHeadCell<T> {
  id: Extract<keyof T, string>;
  label: string;
  sortable?: boolean;
}
