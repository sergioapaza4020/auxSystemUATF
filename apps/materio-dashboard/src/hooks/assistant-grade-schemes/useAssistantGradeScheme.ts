'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeCreate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import {
  createAssistantGradeScheme,
  getMyAssistantGradeScheme,
  updateAssistantGradeScheme,
  deleteAssistantGradeScheme,
  reactivateAssistantGradeScheme,
} from '@/api/assistant-grade-schemes.service';

export function useAssistantGradeScheme(idCourse: number | null, idEnrollment?: number) {
  const [scheme, setScheme] = useState<IAssistantGradeScheme | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!idCourse) {
      setScheme(null);
      setLoading(false);

      return;
    }

    setLoading(true);

    try {
      const data = await getMyAssistantGradeScheme(idCourse, idEnrollment);

      setScheme(data);
    } finally {
      setLoading(false);
    }
  }, [idCourse, idEnrollment]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (data: IAssistantGradeSchemeCreate) => {
    if (!idCourse) {
      throw new Error('Materia no especificada');
    }

    setSaving(true);

    try {
      const created = await createAssistantGradeScheme(idCourse, data, idEnrollment);

      setScheme(created);

      return created;
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: number) => {
    setSaving(true);

    try {
      await deleteAssistantGradeScheme(id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (id: number) => {
    setSaving(true);

    try {
      await reactivateAssistantGradeScheme(id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const update = async (idAssistantGradeScheme: number, data: IAssistantGradeSchemeCreate) => {
    setSaving(true);

    try {
      const updated = await updateAssistantGradeScheme(idAssistantGradeScheme, data);

      setScheme(updated);

      return updated;
    } finally {
      setSaving(false);
    }
  };

  return {
    scheme,
    loading,
    saving,
    create,
    update,
    load,
    deactivate,
    reactivate,
  };
}
