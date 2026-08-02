import type { DataColumn } from '../interfaces/dataColumn';
import type { SpecialColumn } from '../interfaces/specialColumn';

export type HeadCell<T> = DataColumn<T> | SpecialColumn;
