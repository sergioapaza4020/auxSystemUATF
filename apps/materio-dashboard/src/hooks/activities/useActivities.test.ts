import { createElement } from 'react';

import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createActivity,
  deleteActivity,
  getActivitiesByGradeSchemeDetail,
  reactivateActivity,
  updateActivity,
} from '@/api/activities.service';
import type { IActivity } from '@/interfaces/activities/activity.interface';

import { useActivities } from './useActivities';

vi.mock('@/api/activities.service', () => ({
  createActivity: vi.fn(),
  deleteActivity: vi.fn(),
  reactivateActivity: vi.fn(),
  updateActivity: vi.fn(),
  getActivitiesByGradeSchemeDetail: vi.fn(),
}));

const activity: IActivity = {
  idActivity: 1,
  isActive: true,
  name: 'Práctica',
  dueDate: '2026-10-20',
  publicationDate: '2026-10-05',
};

// Render the real hook without a browser; exercise its mutations and refresh contract.
function renderHook(onChanged: () => Promise<void>) {
  let result!: ReturnType<typeof useActivities>;

  function Harness() {
    result = useActivities(4, 1, onChanged);

    return null;
  }

  renderToString(createElement(Harness));

  return result;
}

beforeEach(() => vi.resetAllMocks());

describe('Activity summary refresh', () => {
  it.each(['create', 'update', 'remove', 'reactivate'] as const)(
    'refreshes backend summaries after %s',
    async (operation) => {
      vi.mocked(getActivitiesByGradeSchemeDetail).mockResolvedValue([activity]);
      vi.mocked(createActivity).mockResolvedValue(activity);
      vi.mocked(updateActivity).mockResolvedValue(activity);
      vi.mocked(deleteActivity).mockResolvedValue({ ...activity, isActive: false });
      vi.mocked(reactivateActivity).mockResolvedValue(activity);

      const reload = vi.fn().mockResolvedValue(undefined);
      const hook = renderHook(reload);

      if (operation === 'create') {
        await hook.create({ gradeSchemeDetailId: 4, name: activity.name, dueDate: activity.dueDate });
      } else if (operation === 'update') {
        await hook.update(1, { name: 'Práctica editada' });
      } else {
        await hook[operation](1);
      }

      expect(getActivitiesByGradeSchemeDetail).toHaveBeenCalledWith(4);
      expect(reload).toHaveBeenCalledTimes(1);
    },
  );

  it('does not refresh when deletion fails', async () => {
    vi.mocked(deleteActivity).mockRejectedValue(new Error('No eliminada'));

    const reload = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(reload);

    await expect(hook.remove(1)).rejects.toThrow('No eliminada');
    expect(reload).not.toHaveBeenCalled();
  });
});
