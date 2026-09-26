export interface IGradeItem {
  idGradeItem: number;
  name: string;
  isActive: boolean;
}

export type IGradeItemWrite = Pick<IGradeItem, 'name'>;
