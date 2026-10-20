'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createAttendanceSession,
  getAttendanceSession,
  getAttendanceSessionsByEnrollment,
  type IAttendanceSave,
  type AttendanceHistoryQuery,
  saveAttendances,
} from '@/api/attendances.service';

import type {
  IAttendanceSessionDetail,
  IAttendanceSessionSummary,
} from '@/interfaces/attendances/attendance.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useAttendances(idEnrollment: number | null) {
  const [sessions, setSessions] = useState<IAttendanceSessionSummary[]>([]);
  const [session, setSession] = useState<IAttendanceSessionDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState<AttendanceHistoryQuery>({ page: 1, limit: 5 });
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 5, total: 0, totalPages: 0 });
  const [recentSessions, setRecentSessions] = useState<IAttendanceSessionSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const historyRequest = useRef<AbortController | null>(null);
  const recentRequest = useRef<AbortController | null>(null);
  const dateRequest = useRef<AbortController | null>(null);
  const currentQuery = useRef(query);
  const currentSession = useRef(session);

  currentQuery.current = query;
  currentSession.current = session;

  const changeQuery = (patch: Partial<AttendanceHistoryQuery>) => {
    historyRequest.current?.abort();
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  };

  const loadHistory = useCallback(
    async (requested: AttendanceHistoryQuery, reportError = true) => {
      historyRequest.current?.abort();
      const controller = new AbortController();

      historyRequest.current = controller;

      if (!idEnrollment) {
        setSessions([]);
        setMeta({ page: 1, limit: requested.limit, total: 0, totalPages: 0 });
        setLoading(false);

        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await getAttendanceSessionsByEnrollment(idEnrollment, requested, controller.signal);

        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, response.meta.totalPages);

        if (requested.page > lastPage) {
          setQuery((previous) => ({ ...previous, page: lastPage }));

          return;
        }

        setSessions(response.data);
        setMeta(response.meta);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (reportError) setError(getApiErrorMessage(cause));
        throw cause;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [idEnrollment],
  );

  const loadRecent = useCallback(
    async (reportError = true) => {
      recentRequest.current?.abort();
      const controller = new AbortController();

      recentRequest.current = controller;

      if (!idEnrollment) {
        setRecentSessions([]);
        setRecentLoading(false);

        return;
      }

      setRecentLoading(true);

      try {
        const response = await getAttendanceSessionsByEnrollment(
          idEnrollment,
          { page: 1, limit: 5 },
          controller.signal,
        );

        if (!controller.signal.aborted) setRecentSessions(response.data);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (reportError) setError(getApiErrorMessage(cause));
        throw cause;
      } finally {
        if (!controller.signal.aborted) setRecentLoading(false);
      }
    },
    [idEnrollment],
  );

  const findSessionByDate = useCallback(
    async (date: string) => {
      if (!idEnrollment) return undefined;
      dateRequest.current?.abort();
      const controller = new AbortController();

      dateRequest.current = controller;

      const response = await getAttendanceSessionsByEnrollment(
        idEnrollment,
        { page: 1, limit: 1, date },
        controller.signal,
      );

      controller.signal.throwIfAborted();

      return response.data[0];
    },
    [idEnrollment],
  );

  const loadSessions = useCallback(async () => {
    const refreshSelected = async () => {
      const selected = currentSession.current;

      if (!selected) return;
      const summary = await findSessionByDate(selected.date.slice(0, 10));

      if (summary)
        setSession((current) =>
          current?.idAttendanceSession === summary.idAttendanceSession ? { ...current, ...summary } : current,
        );
    };

    // Mutations already report their refresh failures; avoid a duplicate Snackbar.
    await Promise.all([loadHistory(currentQuery.current, false), loadRecent(false), refreshSelected()]);
  }, [loadHistory, loadRecent, findSessionByDate]);

  const loadSession = useCallback(
    async (idSession: number) => {
      const data = await getAttendanceSession(idSession, { page: 1, limit: 25 });

      // The detail endpoint returns marks; the paginated endpoint computes the saved summary.
      const summary = await findSessionByDate(data.date.slice(0, 10));
      const detail = summary?.idAttendanceSession === idSession ? { ...data, ...summary } : data;

      setSession(detail);

      return detail;
    },
    [findSessionByDate],
  );

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

      setSession((current) => {
        if (current?.idAttendanceSession !== idSession) return current;

        const confirmed = new Map(result.map((record) => [record.enrollment.idEnrollment, record]));

        for (const record of current.attendances) {
          const id = record.enrollment.idEnrollment;

          if (!confirmed.has(id)) confirmed.set(id, record);
        }

        return { ...current, attendances: [...confirmed.values()] };
      });

      return result;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(query).catch(() => undefined);

    return () => historyRequest.current?.abort();
  }, [loadHistory, query]);

  useEffect(() => {
    void loadRecent().catch(() => undefined);

    return () => recentRequest.current?.abort();
  }, [loadRecent]);

  useEffect(() => () => dateRequest.current?.abort(), [idEnrollment]);

  return {
    sessions,
    recentSessions,
    recentLoading,
    query,
    meta,
    changeQuery,
    findSessionByDate,
    session,
    error,
    loading,
    saving,
    loadSessions,
    loadSession,
    createSession,
    saveSessionAttendances,
  };
}
