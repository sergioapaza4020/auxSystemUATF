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

export function useActivities(idGradeSchemeDetail: number | null, idCourse: number | null) {
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

      setActivities((current) => [...current, activity].sort((a, b) => a.order - b.order));

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const update = async (idActivity: number, data: IActivityUpdate) => {
    setSaving(true);

    try {
      const activity = await updateActivity(idActivity, data);

      setActivities((current) =>
        current.map((item) => (item.idActivity === idActivity ? activity : item)).sort((a, b) => a.order - b.order),
      );

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (idActivity: number) => {
    setSaving(true);

    try {
      const activity = await deleteActivity(idActivity);

      setActivities((current) => current.filter((item) => item.idActivity !== idActivity));

      return activity;
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (idActivity: number) => {
    setSaving(true);

    try {
      const activity = await reactivateActivity(idActivity);

      setActivities((current) => [...current, activity].sort((a, b) => a.order - b.order));

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
