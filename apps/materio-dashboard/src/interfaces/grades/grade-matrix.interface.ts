export interface IGradeMatrix {
  enrollment: {
    idEnrollment: number;
    idCourse: number;
    code: string;
    name: string;
    group: number;
    assistantName: string;
  };
  scheme: { idGradeScheme: number; assistantPercentage: number } | null;
  criteria: { idGradeSchemeDetail: number; name: string; percentage: number; activityCount: number }[];
  detail: { idGradeSchemeDetail: number; name: string; percentage: number } | null;
  activities: {
    idActivity: number;
    name: string;
    dueDate: string;
    publicationDate: string | null;
    description: string | null;
  }[];
  students: { idEnrollment: number; name: string; lastname: string; ci: string | null; ru: string | null }[];
  grades: IMatrixGrade[];
}

export interface IMatrixGrade {
  idGrade: number;
  enrollmentId: number;
  activityId: number;
  score: number;
}
export interface IBulkActivityGrade {
  enrollmentId: number;
  activityId: number;
  score: number;
}
