import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IGradeSchemeDetailCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

export const getDetail = (idGradeItem: number, details: IGradeSchemeDetailCreateOrEdit[]) =>
  details.find((detail) => detail.gradeItem.idGradeItem === idGradeItem);

export const toggleGradeItem = (details: IGradeSchemeDetailCreateOrEdit[], gradeItem: IGradeItem, checked: boolean) => {
  if (checked) {
    return [
      ...details,
      {
        percentage: 0,
        order: details.length + 1,
        gradeItem,
      },
    ];
  }

  return details.filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem);
};

export const calculateTotalPercentage = (details: IGradeSchemeDetailCreateOrEdit[]): number =>
  details.reduce((sum, detail) => sum + detail.percentage, 0);

export const changePercentage = (
  details: IGradeSchemeDetailCreateOrEdit[],
  idGradeItem: number,
  percentage: number,
): IGradeSchemeDetailCreateOrEdit[] => {
  percentage = Math.max(0, Math.min(100, percentage));

  return details.map((detail) =>
    detail.gradeItem.idGradeItem === idGradeItem
      ? {
          ...detail,
          percentage,
        }
      : detail,
  );
};
