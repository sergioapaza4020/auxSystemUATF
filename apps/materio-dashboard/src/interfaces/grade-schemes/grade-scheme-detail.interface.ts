export interface IGradeSchemeDetailBase {
  percentage: number;
  permissionWeight?: number;
  order: number;
  gradeItem: {
    idGradeItem: number;
  };
}
