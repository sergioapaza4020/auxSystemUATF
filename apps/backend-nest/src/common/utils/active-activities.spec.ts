import { Activity } from 'src/entities/activities/activity.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { withActiveActivities } from './active-activities';

function activity(
  idActivity: number,
  dueDate: string,
  isActive = true,
  deletedAt: Date | null = null,
) {
  return Object.assign(new Activity(), {
    idActivity,
    dueDate,
    isActive,
    deletedAt,
    createdAt: new Date('2026-10-01'),
  });
}
describe('Academic summary activities', () => {
  it('excludes inactive and soft-deleted history, sorts deadlines and breaks ties by id', () => {
    const detail = Object.assign(new GradeSchemeDetail(), {
      activities: [
        activity(3, '2026-10-20'),
        activity(2, '2026-10-10'),
        activity(1, '2026-10-10'),
        activity(4, '2026-10-01', false),
        activity(5, '2026-10-01', true, new Date()),
      ],
    });
    const scheme = Object.assign(new GradeScheme(), { details: [detail] });
    expect(
      withActiveActivities(scheme).details[0].activities.map((item) => item.idActivity),
    ).toEqual([1, 2, 3]);
  });
  it('accepts missing configurations', () => expect(withActiveActivities(null)).toBeNull());
});
