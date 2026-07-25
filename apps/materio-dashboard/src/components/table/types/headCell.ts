import type { IHeadCell } from '../interfaces/headCell';
import type { SpecialColumn } from '../interfaces/specialColumn';

export type HeadCell<T> = IHeadCell<T> | SpecialColumn;
