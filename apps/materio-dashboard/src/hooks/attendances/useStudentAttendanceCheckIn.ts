'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import axios from 'axios';

import { checkInAttendance, getMyAttendanceSessions } from '@/api/attendances.service';
import type {
  AttendanceCheckInPayload,
  IMyAttendanceSession,
} from '@/interfaces/attendances/student-attendance.interface';
import { getCurrentBrowserPosition } from '@/utils/browser-geolocation';
import {
  attendanceCheckInErrorCode,
  checkInRequiresRefresh,
  getAttendanceCheckInErrorMessage,
} from '@/utils/attendance-check-in';

type Phase = 'IDLE' | 'OBTAINING_LOCATION' | 'CHECKING_IN';
type Feedback = { severity: 'success' | 'info' | 'error' | 'warning'; message: string } | null;

export function useStudentAttendanceCheckIn(
  idEnrollment: number | null,
  onAcademicRefresh: () => void | Promise<void>,
) {
  const [sessions, setSessions] = useState<IMyAttendanceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [blockedIds, setBlockedIds] = useState<number[]>([]);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const busy = useRef(false);
  const listRequest = useRef<AbortController | null>(null);
  const postRequest = useRef<AbortController | null>(null);
  const loadingPromise = useRef<Promise<void> | null>(null);
  const confirmed = useRef(new Map<number, Pick<IMyAttendanceSession, 'ownStatus' | 'ownMarkedAt'>>());
  const verifiedRegistrations = useRef(new Set<number>());
  const pendingVerification = useRef<number | null>(null);
  const academicRefresh = useRef(onAcademicRefresh);
  const context = useRef(idEnrollment);

  academicRefresh.current = onAcademicRefresh;
  context.current = idEnrollment;

  const reload = useCallback(
    (force = false): Promise<void> => {
      if (!idEnrollment || !Number.isSafeInteger(idEnrollment) || idEnrollment <= 0) return Promise.resolve();
      if (loadingPromise.current && !force) return loadingPromise.current;
      if (force) listRequest.current?.abort();
      const generation = epoch.current;
      const controller = new AbortController();

      const current = () =>
        mounted.current &&
        generation === epoch.current &&
        context.current === idEnrollment &&
        listRequest.current === controller;

      listRequest.current = controller;
      setLoading(true);
      setListError('');

      const request = getMyAttendanceSessions(idEnrollment, controller.signal)
        .then((response) => {
          if (!current() || controller.signal.aborted) return;
          verifiedRegistrations.current = new Set(
            response.data.filter((session) => session.alreadyRegistered).map((session) => session.idAttendanceSession),
          );

          if (pendingVerification.current !== null) {
            setFeedback(
              verifiedRegistrations.current.has(pendingVerification.current)
                ? { severity: 'info', message: 'Tu asistencia aparece registrada en el servidor.' }
                : {
                    severity: 'warning',
                    message:
                      'No pudimos confirmar el registro anterior. El estado fue actualizado; si la sesión sigue abierta, puedes volver a intentarlo.',
                  },
            );
            pendingVerification.current = null;
          }

          setSessions(
            response.data.map((session) => {
              const local = confirmed.current.get(session.idAttendanceSession);

              return local && !session.alreadyRegistered ? { ...session, ...local, alreadyRegistered: true } : session;
            }),
          );
          setHasMore(response.meta.hasMore);
          setBlockedIds([]);
        })
        .catch((error: unknown) => {
          if (current() && !controller.signal.aborted) setListError(getAttendanceCheckInErrorMessage(error));
          throw error;
        })
        .finally(() => {
          if (current()) {
            setLoading(false);
            loadingPromise.current = null;
          }
        });

      loadingPromise.current = request;

      return request;
    },
    [idEnrollment],
  );

  useEffect(() => {
    const confirmedMarks = confirmed.current;

    epoch.current += 1;
    mounted.current = true;
    busy.current = false;
    loadingPromise.current = null;
    confirmedMarks.clear();
    verifiedRegistrations.current.clear();
    pendingVerification.current = null;
    setSessions([]);
    setLoading(false);
    setPhase('IDLE');
    setActiveSessionId(null);
    setFeedback(null);
    setBlockedIds([]);
    setHasMore(false);
    setListError('');
    void reload().catch(() => undefined);

    return () => {
      mounted.current = false;
      epoch.current += 1;
      listRequest.current?.abort();
      postRequest.current?.abort();
      confirmedMarks.clear();
    };
  }, [reload]);

  // One boundary refresh, never a polling loop. The server still supplies the state.
  useEffect(() => {
    const now = Date.now();

    const boundary = Math.min(
      ...sessions
        .map((session) => Date.parse(session.state === 'SCHEDULED' ? session.startsAt : session.endsAt))
        .filter((time) => Number.isFinite(time) && time > now),
    );

    if (!Number.isFinite(boundary)) return;

    const timer = window.setTimeout(
      () => {
        void reload().catch(() => undefined);
        void Promise.resolve()
          .then(() => academicRefresh.current())
          .catch(() => undefined);
      },
      Math.min(boundary - now + 500, 2147483647),
    );

    return () => window.clearTimeout(timer);
  }, [sessions, reload]);

  const checkIn = async (idSession: number) => {
    const session = sessions.find((item) => item.idAttendanceSession === idSession);

    if (
      busy.current ||
      !mounted.current ||
      !idEnrollment ||
      !session ||
      session.state !== 'OPEN' ||
      session.alreadyRegistered ||
      confirmed.current.has(idSession) ||
      blockedIds.includes(idSession)
    )
      return;
    busy.current = true;
    const generation = epoch.current;
    const current = () => mounted.current && generation === epoch.current && context.current === idEnrollment;

    setActiveSessionId(idSession);
    setPhase('OBTAINING_LOCATION');
    setFeedback(null);
    let position: AttendanceCheckInPayload | null = null;
    let postAttempted = false;

    try {
      // Coordinates exist only in this operation's local scope, never in React state or storage.
      position = await getCurrentBrowserPosition();

      if (!current()) return;
      const controller = new AbortController();

      postRequest.current = controller;
      setPhase('CHECKING_IN');
      postAttempted = true;
      const result = await checkInAttendance(idSession, position, controller.signal);

      position = null;

      if (!current()) return;
      if (result.code !== 'SUCCESS') throw new Error('UNEXPECTED_CHECK_IN_RESPONSE');
      const mark = { ownStatus: result.status, ownMarkedAt: result.markedAt };

      confirmed.current.set(idSession, mark);
      setSessions((previous) =>
        previous.map((item) =>
          item.idAttendanceSession === idSession ? { ...item, ...mark, alreadyRegistered: true } : item,
        ),
      );
      setFeedback({
        severity: 'success',
        message: 'Asistencia registrada correctamente. Tu resumen académico se actualizará cuando la sesión finalice.',
      });

      const refreshes = await Promise.allSettled([
        reload(true),
        Promise.resolve().then(() => academicRefresh.current()),
      ]);

      if (current() && refreshes.some((result) => result.status === 'rejected'))
        setFeedback({
          severity: 'warning',
          message: 'Tu asistencia fue registrada. No se pudo actualizar toda la información; pulsa Actualizar.',
        });
    } catch (error: unknown) {
      if (!current()) return;
      const code = attendanceCheckInErrorCode(error);

      const uncertain =
        !code && postAttempted && (!axios.isAxiosError(error) || !error.response || error.response.status >= 500);

      if (uncertain) {
        pendingVerification.current = idSession;
        setBlockedIds((previous) => [...new Set([...previous, idSession])]);
        setFeedback({
          severity: 'warning',
          message:
            'No pudimos confirmar la respuesta del registro. Estamos consultando su estado; no vuelvas a enviarlo todavía.',
        });

        try {
          await reload(true);
        } catch {
          if (current())
            setFeedback({
              severity: 'warning',
              message:
                'No pudimos verificar si tu asistencia se registró. Pulsa Actualizar cuando recuperes la conexión antes de volver a intentar.',
            });
        }

        if (current())
          await Promise.resolve()
            .then(() => academicRefresh.current())
            .catch(() => undefined);

        return;
      }

      if (code === 'ALREADY_REGISTERED') {
        confirmed.current.set(idSession, { ownStatus: session.ownStatus, ownMarkedAt: session.ownMarkedAt });
        setSessions((previous) =>
          previous.map((item) =>
            item.idAttendanceSession === idSession ? { ...item, alreadyRegistered: true } : item,
          ),
        );
      }

      if (checkInRequiresRefresh(code)) setBlockedIds((previous) => [...new Set([...previous, idSession])]);
      setFeedback({
        severity: code === 'ALREADY_REGISTERED' ? 'info' : 'error',
        message: getAttendanceCheckInErrorMessage(error),
      });
      if (checkInRequiresRefresh(code))
        await Promise.allSettled([reload(true), Promise.resolve().then(() => academicRefresh.current())]);
    } finally {
      position = null;

      if (current()) {
        busy.current = false;
        setPhase('IDLE');
        setActiveSessionId(null);
        postRequest.current = null;
      }
    }
  };

  return { sessions, loading, listError, hasMore, phase, activeSessionId, feedback, blockedIds, reload, checkIn };
}
