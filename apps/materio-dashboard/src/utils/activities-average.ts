import { averageScores } from '@repo/grade-calculations';

import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';

export function calculateActivitiesAverage(activities: readonly IActivity[], grades: readonly IGrade[]): number {
  const activeActivities = activities.filter((activity) => activity.isActive);

  return (
    averageScores(
      activeActivities.map(
        (activity) => grades.find((grade) => grade.activity?.idActivity === activity.idActivity)?.score ?? 0,
      ),
    ) ?? 0
  );
}
