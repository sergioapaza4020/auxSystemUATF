import { Activity } from 'src/entities/activities/activity.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { compareActivities } from './activity-rules';

export function isActiveActivity(activity: Activity): boolean {
  return activity.isActive && activity.deletedAt == null;
}

/** Normalize loaded relations before returning academic summaries; preserve stored history. */
export function withActiveActivities<T extends GradeScheme | null>(scheme: T): T {
  if (scheme) {
    for (const detail of scheme.details ?? []) {
      detail.activities = (detail.activities ?? [])
        .filter(isActiveActivity)
        .sort(compareActivities);
    }
  }
  return scheme;
}
