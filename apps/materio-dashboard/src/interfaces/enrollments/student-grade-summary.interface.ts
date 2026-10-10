export interface IStudentGradeSummary {
  scheme: {
    idGradeScheme: number;
    assistantPercentage: number;
    details: { idGradeSchemeDetail: number; name: string; percentage: number; maximumScore: number }[];
  } | null;
  students: {
    idEnrollment: number;
    details: { idGradeSchemeDetail: number; rawScore: number | null; weightedScore: number | null }[];
    totalRaw: number | null;
    assistantContribution: number | null;
  }[];
}
