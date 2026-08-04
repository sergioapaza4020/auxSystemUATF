import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IDetail } from '@/interfaces/grade-schemes/grade-scheme.interface';

export const getDetail = (idGradeItem: number, details: IDetail[]) =>
  details.find((detail) => detail.gradeItem.idGradeItem === idGradeItem);

export const toggleGradeItem = (details: IDetail[], gradeItem: IGradeItem, checked: boolean) => {
  if (checked) {
    return [
      ...details,
      {
        percentage: 0,
        gradeItem,
      },
    ];
  }

  return details.filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem);
};

export const calculateTotalPercentage = (details: IDetail[]): number =>
  details.reduce((sum, detail) => sum + detail.percentage, 0);

export const changePercentage = (details: IDetail[], idGradeItem: number, percentage: number): IDetail[] => {
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
