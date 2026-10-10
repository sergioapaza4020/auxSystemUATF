'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createActivity,
  deleteActivity,
  getActivitiesByGradeSchemeDetail,
  reactivateActivity,
  updateActivity,
  type IActivityCreate,
  type IActivityUpdate,
} from '@/api/activities.service';

import type { IActivity } from '@/interfaces/activities/activity.interface';

export function useActivities(
  idGradeSchemeDetail: number | null,
  idCourse: number | null,
  onChanged?: () => Promise<void>,
) {
  const [activities, setActivities] = useState<IActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!idGradeSchemeDetail) {
      setActivities([]);

      return;
    }

    setLoading(true);

    try {
      const data = await getActivitiesByGradeSchemeDetail(idGradeSchemeDetail);

      setActivities(data);
    } finally {
      setLoading(false);
    }
  }, [idGradeSchemeDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (data: IActivityCreate) => {
    if (!idCourse) {
      throw new Error('No se encontró la materia');
    }

    setSaving(true);

    try {
      const activity = await createActivity(idCourse, data);

      await load();
      await onChanged?.();

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const update = async (idActivity: number, data: IActivityUpdate) => {
    setSaving(true);

    try {
      const activity = await updateActivity(idActivity, data);

      await load();
      await onChanged?.();

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (idActivity: number) => {
    setSaving(true);

    try {
      const activity = await deleteActivity(idActivity);

      await load();
      await onChanged?.();

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (idActivity: number) => {
    setSaving(true);

    try {
      const activity = await reactivateActivity(idActivity);

      await load();
      await onChanged?.();

      return activity;
    } finally {
      setSaving(false);
    }
  };

  return {
    activities,
    loading,
    saving,
    load,
    create,
    update,
    remove,
    reactivate,
  };
}
