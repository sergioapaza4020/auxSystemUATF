export type GradeImportChoice = { column: string; activityId?: number; detailId?: number; acceptDate?: boolean };

type Activity = { id: number; name: string; detailId: number; dueDate: string };

export type GradeImportSummary = {
  identified: number;
  existingActivities: number;
  newActivities: number;
  similar: number;
  created: number;
  updated: number;
  skipped: number;
  empty: number;
  errors: number;
  warnings: number;
};

export type GradeImportPreview = {
  operationId: string | null;
  columns: {
    column: string;
    name: string;
    dueDate: string | null;
    activity?: Activity;
    detail?: { id: number; name: string };
    suggestions: (Activity & { exact: boolean; reason: string })[];
    automaticActivityId: number | null;
  }[];
  choices: Activity[];
  criteria: { id: number; name: string }[];
  canCreate: boolean;
  canUpdate: boolean;
  summary: GradeImportSummary;
  errors: { row: number; column: string; ru?: string; activity?: string; message: string }[];
  warnings: string[];
  conflicts: { row: number; column: string; ru: string; activity: string; score: number; previous: number }[];
};
