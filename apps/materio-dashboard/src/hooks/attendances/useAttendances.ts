'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createAttendanceSession,
  getAttendanceSession,
  getAttendanceSessionsByEnrollment,
  type IAttendanceSave,
  saveAttendances,
} from '@/api/attendances.service';

import type {
  IAttendanceSessionDetail,
  IAttendanceSessionSummary,
} from '@/interfaces/attendances/attendance.interface';

export function useAttendances(idEnrollment: number | null) {
  const [sessions, setSessions] = useState<IAttendanceSessionSummary[]>([]);
  const [session, setSession] = useState<IAttendanceSessionDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!idEnrollment) {
      setSessions([]);

      return;
    }

    setLoading(true);

    try {
      const data = await getAttendanceSessionsByEnrollment(idEnrollment);

      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, [idEnrollment]);

  const loadSession = useCallback(async (idSession: number) => {
    setLoading(true);

    try {
      const data = await getAttendanceSession(idSession);

      setSession(data);

      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (date: string) => {
      if (!idEnrollment) {
        throw new Error('No se encontró la matrícula del auxiliar.');
      }

      setSaving(true);

      try {
        const data = await createAttendanceSession({
          enrollmentId: idEnrollment,
          date,
        });

        await loadSessions();

        return data;
      } finally {
        setSaving(false);
      }
    },
    [idEnrollment, loadSessions],
  );

  const saveSessionAttendances = useCallback(async (idSession: number, data: IAttendanceSave) => {
    setSaving(true);

    try {
      const result = await saveAttendances(idSession, data);

      setSession(result);

      return result;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    session,
    loading,
    saving,
    loadSessions,
    loadSession,
    createSession,
    saveSessionAttendances,
  };
}
