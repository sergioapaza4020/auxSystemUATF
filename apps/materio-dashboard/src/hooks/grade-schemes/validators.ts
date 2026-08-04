import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';
import { calculateTotalPercentage } from './helpers';

export const isGradeSchemeValid = (form: IGradeSchemeCreateOrEdit): boolean => {
  if (!form) return false;
  if (!form.name.trim()) return false;
  if (form.details.length === 0) return false;

  const totalPercentage = calculateTotalPercentage(form.details);

  if (totalPercentage !== 100) return false;

  return form.details.every((detail) => detail.percentage > 0);
};
