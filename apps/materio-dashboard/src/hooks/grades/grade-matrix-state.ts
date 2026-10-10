import { averageScores } from '@repo/grade-calculations';

import type { IGradeMatrix, IBulkActivityGrade } from '@/interfaces/grades/grade-matrix.interface';

export type GradeOriginals = Record<string, number | null>;
export type GradeDrafts = Record<string, string>;
export const gradeCellKey = (enrollmentId: number, activityId: number) => `${enrollmentId}:${activityId}`;

export function parseGradeDraft(value: string, original: number | null) {
  if (!value.trim())
    return { score: null, error: original === null ? null : 'La nota guardada no puede quedar vacía.' };
  const score = Number(value.trim().replace(',', '.'));

  return {
    score: Number.isFinite(score) ? score : null,
    error: !Number.isFinite(score) || score < 0 || score > 100 ? 'Ingresa una nota entre 0 y 100.' : null,
  };
}

export function getGradeChanges(originals: GradeOriginals, drafts: GradeDrafts) {
  return Object.entries(drafts).flatMap(([key, value]) => {
    const original = originals[key] ?? null;
    const parsed = parseGradeDraft(value, original);

    if (!parsed.error && parsed.score === original) return [];
    const [enrollmentId, activityId] = key.split(':').map(Number);

    return [{ key, enrollmentId, activityId, ...parsed }];
  });
}

export function buildGradePayload(originals: GradeOriginals, drafts: GradeDrafts): IBulkActivityGrade[] {
  const changes = getGradeChanges(originals, drafts);

  if (changes.some((change) => change.error || change.score === null))
    throw new Error('Revisa las calificaciones marcadas antes de guardar.');
  if (changes.length > 1000) throw new Error('Puedes guardar hasta 1000 cambios en una operación.');

  return changes.map((change) => ({
    enrollmentId: change.enrollmentId,
    activityId: change.activityId,
    score: change.score!,
  }));
}

export function mergeMatrixOriginals(
  matrix: IGradeMatrix,
  originals: GradeOriginals,
  drafts: GradeDrafts,
): GradeOriginals {
  const result = { ...originals };

  for (const student of matrix.students)
    for (const activity of matrix.activities) {
      const key = gradeCellKey(student.idEnrollment, activity.idActivity);

      if (!(key in drafts)) result[key] = null;
    }

  for (const grade of matrix.grades) {
    const key = gradeCellKey(grade.enrollmentId, grade.activityId);

    if (!(key in drafts)) result[key] = grade.score;
  }

  return result;
}

export function studentCriterionResult(
  enrollmentId: number,
  activityIds: number[],
  originals: GradeOriginals,
  drafts: GradeDrafts,
): number | null {
  const scores: (number | null)[] = [];

  for (const activityId of activityIds) {
    const key = gradeCellKey(enrollmentId, activityId);
    const original = originals[key] ?? null;
    const parsed = key in drafts ? parseGradeDraft(drafts[key], original) : { score: original, error: null };

    if (parsed.error) return null;
    scores.push(parsed.score);
  }

  return averageScores(scores);
}

export function nextStudentCell(
  enrollmentId: number,
  activityId: number,
  studentIds: number[],
  direction: 1 | -1,
): string | null {
  const index = studentIds.indexOf(enrollmentId);
  const next = studentIds[index + direction];

  return index < 0 || next === undefined ? null : gradeCellKey(next, activityId);
}
