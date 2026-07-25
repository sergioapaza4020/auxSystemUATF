import type { SortableIds } from '@/utils/getSortableItems';
import type { gradeSchemeHeadCellsData } from '../data/head-cells.data';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

export type SortableColumn = SortableIds<IGradeScheme, typeof gradeSchemeHeadCellsData>;
