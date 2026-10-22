export function isAttendanceCriterion(name: string): boolean;
export function activeCriteria<T extends { isActive?: boolean }>(
  details: readonly T[],
): T[];
export function attendancePercentage(present: number, total: number): number;
export function averageScores(
  scores: readonly (number | string | null | undefined)[],
  activityCount?: number,
): number | null;
export function weightedScore(
  score: number | null,
  percentage: number,
  multiplier?: number,
): number | null;
export function criterionScore(input: {
  attendance?: { totalSessions: number; percentage: number };
  activityCount: number;
  activityScore: number | null;
  directScore: number | null;
}): number | null;
export function totalScore(
  details: readonly { score: number | null; percentage: number }[],
): number | null;
