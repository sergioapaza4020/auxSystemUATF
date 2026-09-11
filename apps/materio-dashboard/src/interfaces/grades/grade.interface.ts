import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IActivity } from '../activities/activity.interface';

export interface IGrade {
  idGrade: number;
  isActive: boolean;
  score: number;

  enrollment: IEnrollment;

  activity: IActivity | null;

  gradeSchemeDetail: {
    idGradeSchemeDetail: number;
    percentage: number;
    order: number;

    gradeItem: {
      idGradeItem: number;
      name: string;
    };

    gradeScheme: {
      idGradeScheme: number;
      name: string;
      description?: string;
    };
  };
}
