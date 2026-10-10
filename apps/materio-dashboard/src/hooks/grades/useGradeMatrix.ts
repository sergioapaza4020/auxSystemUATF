'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import axios from 'axios';

import { getGradeMatrix, saveActivityGrades } from '@/api/grade-matrix.service';
import type { IGradeMatrix } from '@/interfaces/grades/grade-matrix.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { readGradeDraftSession, serializeGradeDraftSession } from './grade-draft-session';
import {
  buildGradePayload,
  getGradeChanges,
  mergeMatrixOriginals,
  type GradeDrafts,
  type GradeOriginals,
} from './grade-matrix-state';

export function useGradeMatrix(idEnrollment: number, enabled: boolean, idUser?: number) {
  const [matrix, setMatrix] = useState<IGradeMatrix | null>(null);
  const [detailId, setDetailId] = useState<number | undefined>();
  const [originals, setOriginals] = useState<GradeOriginals>({});
  const [drafts, setDrafts] = useState<GradeDrafts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const draftRef = useRef(drafts);
  const sessionLoaded = useRef(false);
  const sessionKey = idUser ? `uatf:grade-drafts:${idUser}:${idEnrollment}` : null;

  draftRef.current = drafts;

  useEffect(() => {
    if (!enabled || !sessionKey) return;

    sessionLoaded.current = false;

    try {
      const stored = readGradeDraftSession(window.sessionStorage.getItem(sessionKey));

      setOriginals(stored.originals);
      setDrafts(stored.drafts);
      draftRef.current = stored.drafts;
    } catch {
      // Editing remains available when browser storage is disabled.
    }
  }, [enabled, sessionKey]);

  useEffect(() => {
    if (!enabled || !sessionKey) return;

    if (!sessionLoaded.current) {
      sessionLoaded.current = true;

      return;
    }

    try {
      const stored = serializeGradeDraftSession(originals, drafts);

      if (stored) window.sessionStorage.setItem(sessionKey, stored);
      else window.sessionStorage.removeItem(sessionKey);
    } catch {
      // The in-memory draft is kept even if session storage is unavailable.
    }
  }, [originals, drafts, enabled, sessionKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);

      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);
    void getGradeMatrix(idEnrollment, detailId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setMatrix(data);
        setOriginals((current) => mergeMatrixOriginals(data, current, draftRef.current));
      })
      .catch((reason) => {
        if (!controller.signal.aborted && !axios.isCancel(reason)) setError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [idEnrollment, detailId, enabled, revision]);

  const changes = useMemo(() => getGradeChanges(originals, drafts), [originals, drafts]);
  const invalidCount = changes.filter((change) => change.error).length;

  const edit = useCallback((key: string, value: string) => {
    if (busy.current) return;
    setDrafts((current) => ({ ...current, [key]: value }));
  }, []);

  const save = async (): Promise<boolean> => {
    if (busy.current) return false;
    const payload = buildGradePayload(originals, drafts);

    if (!payload.length) return false;
    busy.current = true;
    setSaving(true);

    try {
      const confirmed = await saveActivityGrades(idEnrollment, payload);

      // Adopt only server-confirmed scores, including the database's numeric precision.
      const expectedKeys = new Set(payload.map((grade) => `${grade.enrollmentId}:${grade.activityId}`));
      const confirmedKeys = new Set(confirmed.map((grade) => `${grade.enrollmentId}:${grade.activityId}`));

      if (
        confirmed.length !== payload.length ||
        confirmedKeys.size !== expectedKeys.size ||
        confirmed.some(
          (grade) =>
            !expectedKeys.has(`${grade.enrollmentId}:${grade.activityId}`) ||
            !Number.isFinite(grade.score) ||
            grade.score < 0 ||
            grade.score > 100,
        )
      )
        throw new Error('La respuesta de guardado está incompleta. Tus cambios se conservan.');
      setOriginals((current) => ({
        ...current,
        ...Object.fromEntries(confirmed.map((grade) => [`${grade.enrollmentId}:${grade.activityId}`, grade.score])),
      }));
      setMatrix((current) => {
        if (!current) return current;

        const activityIds = new Set(current.activities.map((activity) => activity.idActivity));
        const studentIds = new Set(current.students.map((student) => student.idEnrollment));

        return {
          ...current,
          grades: [
            ...current.grades.filter((grade) => !confirmedKeys.has(`${grade.enrollmentId}:${grade.activityId}`)),
            ...confirmed.filter((grade) => activityIds.has(grade.activityId) && studentIds.has(grade.enrollmentId)),
          ],
        };
      });
      setDrafts({});

      return true;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return {
    matrix,
    loading,
    saving,
    error,
    originals,
    drafts,
    changes,
    invalidCount,
    edit,
    save,
    selectCriterion: (id: number) => {
      if (!busy.current) setDetailId(id);
    },
    discard: () => {
      if (!busy.current) setDrafts({});
    },
    reload: () => setRevision((value) => value + 1),
  };
}
