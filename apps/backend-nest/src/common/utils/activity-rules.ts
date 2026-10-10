import { Activity } from 'src/entities/activities/activity.entity';
import { FindOptionsOrder } from 'typeorm';

export const ACTIVITY_ORDER = {
  dueDate: 'ASC',
  createdAt: 'ASC',
  idActivity: 'ASC',
} as const satisfies FindOptionsOrder<Activity>;

export function compareActivities(a: Activity, b: Activity): number {
  return (
    a.dueDate.localeCompare(b.dueDate) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.idActivity - b.idActivity
  );
}
