'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import axios from 'axios';

import {
  checkInCombined,
  getCombinedChallenge,
  checkInWithQr,
  getMyQrMark,
  getQrContext,
} from '@/api/attendances.service';
import { useAuth } from '@/hooks/useAuth';
import type { IQrContext, IQrOwnMark } from '@/interfaces/attendances/student-qr.interface';
import { hasPermission } from '@/utils/hasPermission';
import { getAccessToken, getRefreshToken } from '@/utils/authCookies';
import { clearPendingQr, parseQrFragment, savePendingQr, saveQrReview, takePendingQr } from '@/utils/student-qr-flow';
import { attendanceQrErrorCode } from '@/utils/attendance-qr';
import { qrRequiresRescan, qrRetryAfter, qrUncertainFailure, studentQrError } from '@/utils/student-qr-errors';
import { BrowserLocationError, getCurrentBrowserPosition } from '@/utils/browser-geolocation';
import type { AttendanceCheckInPayload } from '@/interfaces/attendances/student-attendance.interface';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

export type StudentQrPhase =
  | 'INITIALIZING'
  | 'AUTH_REQUIRED'
  | 'LOADING_CONTEXT'
  | 'LOADING_CHALLENGE'
  | 'READY_FOR_LOCATION'
  | 'LOCATING'
  | 'READY_TO_CONFIRM'
  | 'READY'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'ALREADY_REGISTERED'
  | 'EXPIRED'
  | 'ERROR'
  | 'UNCERTAIN';
type Entry = { id: number; sequence: number; restored: boolean; review: boolean };
type Flow = {
  phase: StudentQrPhase;
  context: IQrContext | null;
  mark: IQrOwnMark | null;
  message: string;
  retryAt: number;
};
const initial: Flow = { phase: 'INITIALIZING', context: null, mark: null, message: '', retryAt: 0 };
const missing = 'No encontramos un código de asistencia válido. Escanea nuevamente el código mostrado por tu auxiliar.';

const uncertain =
  'No pudimos confirmar el resultado. La solicitud anterior todavía podría completarse. Consulta tu registro nuevamente; no enviaremos otra confirmación automáticamente.';

export function useStudentQrAttendance() {
  const auth = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [verified, setVerified] = useState<number | null>(null);
  const [flow, setFlow] = useState<Flow>(initial);
  const [reading, setReading] = useState(false);
  const [clock, setClock] = useState(0);
  const authorization = useRef<{ value: string; mono: number; wall: number; duration: number } | null>(null);
  const position = useRef<AttendanceCheckInPayload | null>(null);
  const locationGeneration = useRef(0);
  const [remaining, setRemaining] = useState(0);

  const remainingMs = useCallback(() => {
    const lease = authorization.current;

    return lease
      ? Math.max(0, lease.duration - Math.max(0, performance.now() - lease.mono, Date.now() - lease.wall))
      : 0;
  }, []);

  const clearCombined = useCallback(() => {
    authorization.current = null;
    position.current = null;
    locationGeneration.current += 1;
  }, []);

  const token = useRef<string | null>(null);
  const sequence = useRef(0);
  const receipt = useRef<number | null>(null);
  const alive = useRef(false);
  const captured = useRef(false);
  const handoff = useRef(false);
  const authenticated = useRef<number | null>(null);
  const requests = useRef(new Set<AbortController>());
  const operation = useRef<AbortController | null>(null);
  const currentFlow = useRef(flow);
  const currentAuth = useRef(auth);
  const refreshAuth = useRef(auth.refreshUser);
  const attemptedLogin = useRef(false);
  const owner = useRef<number | null>(null);

  currentFlow.current = flow;
  currentAuth.current = auth;
  refreshAuth.current = auth.refreshUser;
  const userId = auth.user?.idUser ?? null;
  const allowed = hasPermission(auth.user, 'attendance.qr.check-in');

  const forget = useCallback(() => {
    token.current = null;
    clearPendingQr();
  }, []);

  const login = useCallback(() => {
    if (!token.current && !receipt.current) return;
    const saved = token.current ? savePendingQr(token.current) : saveQrReview(receipt.current!);

    if (!saved) {
      setFlow((old) => ({
        ...old,
        phase: 'AUTH_REQUIRED',
        message:
          'El navegador no permite conservar el código durante el login. Inicia sesión desde el panel y vuelve a escanear.',
      }));

      return;
    }

    handoff.current = true;
    router.replace('/login');
  }, [router]);

  const loginRef = useRef(login);

  loginRef.current = login;

  useEffect(() => {
    alive.current = true;
    const pendingRequests = requests.current;

    const capture = (first: boolean) => {
      const hash = window.location.hash;

      if (!first && !hash) return;
      let parsed = hash ? parseQrFragment(hash) : first ? takePendingQr() : null;
      const restored = !hash && !!parsed;

      if (hash) {
        clearPendingQr();
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      }

      requests.current.forEach((request) => request.abort());
      requests.current.clear();
      operation.current = null;
      clearCombined();
      sequence.current += 1;
      handoff.current = false;
      attemptedLogin.current = false;
      token.current = parsed?.token ?? null;
      receipt.current = parsed?.id ?? null;
      setVerified(null);
      setReading(false);
      setEntry(
        parsed
          ? {
              id: parsed.id,
              sequence: sequence.current,
              restored,
              review: 'review' in parsed && parsed.review === true,
            }
          : null,
      );
      setFlow(parsed ? initial : { ...initial, phase: 'ERROR', message: missing });
      parsed = null;
    };

    if (!captured.current) {
      captured.current = true;
      capture(true);
    }

    const changed = () => capture(false);

    const expired = () => {
      sequence.current += 1;
      requests.current.forEach((request) => request.abort());
      operation.current = null;
      clearCombined();
      if (token.current) handoff.current = savePendingQr(token.current);
      else if (receipt.current) handoff.current = saveQrReview(receipt.current);
      setFlow((old) => ({
        ...old,
        phase: 'AUTH_REQUIRED',
        message: 'Tu sesión terminó. Inicia sesión nuevamente y confirma solo si el código sigue vigente.',
      }));
    };

    window.addEventListener('hashchange', changed);
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    return () => {
      alive.current = false;
      clearCombined();
      token.current = null;
      pendingRequests.forEach((request) => request.abort());
      pendingRequests.clear();
      operation.current = null;
      if (!handoff.current) clearPendingQr();
      window.removeEventListener('hashchange', changed);
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    };
  }, [clearCombined]);

  useEffect(() => {
    if (!entry) return;
    let active = true;

    const verify = async () => {
      if (getAccessToken() || getRefreshToken()) await refreshAuth.current();
      if (active && alive.current) setVerified(entry.sequence);
    };

    void verify().catch(() => {
      if (active && alive.current) setVerified(entry.sequence);
    });

    return () => {
      active = false;
    };
  }, [entry]);

  const valid = (controller: AbortController, version: number, identity: number | null) =>
    alive.current &&
    !controller.signal.aborted &&
    sequence.current === version &&
    currentAuth.current.user?.idUser === identity;

  const begin = () => {
    const controller = new AbortController();

    requests.current.add(controller);
    operation.current = controller;

    return controller;
  };

  const finish = (controller: AbortController) => {
    requests.current.delete(controller);
    if (operation.current === controller) operation.current = null;
  };

  const reconcile = async (
    id: number,
    controller: AbortController,
    version: number,
    identity: number | null,
    message = uncertain,
  ) => {
    const result = await getMyQrMark(id, controller.signal);

    if (!valid(controller, version, identity)) return;
    if (result.ownMark) {
      clearCombined();
      forget();
      setFlow((old) => ({
        ...old,
        phase: 'ALREADY_REGISTERED',
        mark: result.ownMark,
        message: 'Tu registro está confirmado en el servidor.',
        retryAt: 0,
      }));
    } else setFlow((old) => ({ ...old, phase: 'UNCERTAIN', mark: null, message, retryAt: 0 }));
  };

  const loadContext = async () => {
    if (
      !entry ||
      verified !== entry.sequence ||
      !userId ||
      !allowed ||
      operation.current ||
      (!token.current && !entry.review) ||
      currentFlow.current.retryAt > Date.now()
    )
      return;
    const version = entry.sequence;
    const identity = userId;
    const controller = begin();

    owner.current = identity;
    setFlow({ ...initial, phase: 'LOADING_CONTEXT' });

    try {
      if (entry.review) {
        await reconcile(entry.id, controller, version, identity);

        return;
      }

      let context = await getQrContext(entry.id, token.current!, controller.signal);

      if (!valid(controller, version, identity)) return;
      if (context.idAttendanceSession !== entry.id || context.state !== 'OPEN') throw new Error('Invalid context');

      if (context.mode !== 'QR' && context.mode !== 'GEOLOCATION_QR') {
        forget();
        throw new Error('Unknown attendance mode');
      }

      if (!token.current && !context.ownMark) return;

      if (context.mode === 'GEOLOCATION_QR' && !context.ownMark) {
        setFlow({ ...initial, phase: 'LOADING_CHALLENGE', context });
        const challengeStarted = performance.now();
        const challenge = await getCombinedChallenge(entry.id, token.current!, controller.signal);

        if (!valid(controller, version, identity)) return;
        if (
          challenge.idAttendanceSession !== entry.id ||
          challenge.mode !== 'GEOLOCATION_QR' ||
          challenge.state !== 'OPEN'
        )
          throw new Error('Invalid challenge');
        context = {
          ...context,
          course: challenge.course,
          date: challenge.date,
          startsAt: challenge.startsAt,
          endsAt: challenge.endsAt,
          ownMark: challenge.ownMark,
        };

        if (!challenge.ownMark) {
          const duration =
            Math.min(
              90000,
              Date.parse(challenge.authorizationExpiresAt ?? '') - Date.parse(challenge.serverNow),
              Date.parse(challenge.endsAt) - Date.parse(challenge.serverNow),
            ) -
            (performance.now() - challengeStarted);

          if (
            !challenge.authorization ||
            !/^[A-Za-z0-9_-]{43}$/.test(challenge.authorization) ||
            !Number.isFinite(duration) ||
            duration <= 0
          )
            throw new Error('Invalid authorization');
          authorization.current = {
            value: challenge.authorization,
            mono: performance.now(),
            wall: Date.now(),
            duration,
          };
          position.current = null;
          setRemaining(Math.ceil(duration / 1000));
          forget();
          setFlow({ phase: 'READY_FOR_LOCATION', context, mark: null, message: '', retryAt: 0 });

          return;
        }
      }

      // A delayed read must not revive a discarded challenge. A confirmed mark is still useful.
      if (!token.current && !context.ownMark) return;
      setFlow({
        phase: context.ownMark ? 'ALREADY_REGISTERED' : 'READY',
        context,
        mark: context.ownMark,
        message: '',
        retryAt: 0,
      });
      if (context.ownMark) forget();
    } catch (error) {
      if (!valid(controller, version, identity) || axios.isCancel(error)) return;
      const code = attendanceQrErrorCode(error);
      const message = studentQrError(error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        loginRef.current();

        return;
      }

      if (qrRequiresRescan(error)) forget();
      setFlow((old) => ({
        ...old,
        phase: code === 'QR_TOKEN_EXPIRED' || code === 'COMBINED_AUTHORIZATION_EXPIRED' ? 'EXPIRED' : 'ERROR',
        message,
        retryAt: qrRetryAfter(error),
      }));

      if (
        code === 'SESSION_CLOSED' ||
        (code === 'SESSION_CANCELLED' && currentFlow.current.context?.mode === 'GEOLOCATION_QR') ||
        code === 'ALREADY_REGISTERED'
      ) {
        try {
          await reconcile(
            entry.id,
            controller,
            version,
            identity,
            message + ' No se confirmó una marca propia; consulta nuevamente.',
          );
        } catch (cause) {
          if (valid(controller, version, identity))
            setFlow((old) => ({
              ...old,
              message: message + ' ' + studentQrError(cause),
              retryAt: qrRetryAfter(cause),
            }));
        }
      }
    } finally {
      finish(controller);
    }
  };

  const load = useRef(loadContext);

  load.current = loadContext;
  useEffect(() => {
    if (!entry || verified !== entry.sequence) return;

    if (!userId) {
      if (authenticated.current && !handoff.current) {
        clearCombined();
        forget();
        setEntry(null);
        setFlow({ ...initial, phase: 'AUTH_REQUIRED', message: 'Inicia sesión y vuelve a escanear el código.' });

        return;
      }

      setFlow((old) => ({ ...old, phase: 'AUTH_REQUIRED' }));

      if (!entry.restored && !attemptedLogin.current) {
        attemptedLogin.current = true;
        loginRef.current();
      }

      return;
    }

    if (owner.current && owner.current !== userId && currentFlow.current.context?.mode === 'GEOLOCATION_QR') {
      clearCombined();
      forget();
      setEntry(null);
      setFlow({ ...initial, phase: 'ERROR', message: 'La cuenta cambió. Escanea nuevamente el código.' });

      return;
    }

    authenticated.current = userId;

    if (!allowed) {
      clearCombined();
      forget();
      setFlow({
        ...initial,
        phase: 'ERROR',
        message: studentQrError({ isAxiosError: true, response: { status: 403 } }),
      });

      return;
    }

    void load.current();
    const pendingRequests = requests.current;

    return () => {
      pendingRequests.forEach((request) => request.abort());
      pendingRequests.clear();
      operation.current = null;
    };
  }, [entry, verified, userId, allowed, forget, clearCombined]);

  // Context has no serverNow: avoid a countdown based on the phone's clock.
  // Backend tokens have at most 35s of validity; bound memory lifetime without extending it.
  useEffect(() => {
    if (!entry) return;

    const timer = setTimeout(() => {
      if (!alive.current || handoff.current || !token.current || authorization.current) return;
      forget();
      if (currentFlow.current.phase !== 'SUBMITTING')
        setFlow((old) => ({
          ...old,
          phase: 'EXPIRED',
          message: 'El código QR caducó. Escanea nuevamente el código que muestra tu auxiliar.',
        }));
    }, 35000);

    return () => clearTimeout(timer);
  }, [entry, forget]);
  useEffect(() => {
    if (!flow.retryAt) return;
    setClock(Date.now());
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, flow.retryAt - Date.now()));

    return () => clearTimeout(timer);
  }, [flow.retryAt]);

  useEffect(() => {
    const tick = () => {
      if (!authorization.current) return;
      const ms = remainingMs();

      setRemaining(Math.ceil(ms / 1000));

      if (ms <= 0) {
        clearCombined();
        forget();
        if (currentFlow.current.phase !== 'SUBMITTING' && currentFlow.current.phase !== 'UNCERTAIN')
          setFlow((old) => ({
            ...old,
            phase: 'EXPIRED',
            message: 'La autorización para registrar asistencia caducó. Escanea nuevamente el QR.',
          }));
      }
    };

    const timer = setInterval(tick, 250);

    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [forget, clearCombined, remainingMs]);

  const locate = async () => {
    if (
      !entry ||
      !userId ||
      !allowed ||
      currentFlow.current.retryAt > Date.now() ||
      operation.current ||
      !['READY_FOR_LOCATION', 'READY_TO_CONFIRM'].includes(currentFlow.current.phase) ||
      remainingMs() <= 0 ||
      owner.current !== userId
    )
      return;
    const controller = begin();
    const version = entry.sequence;
    const generation = ++locationGeneration.current;

    position.current = null;
    setFlow((old) => ({ ...old, phase: 'LOCATING', message: '' }));

    try {
      const point = await getCurrentBrowserPosition();

      if (!valid(controller, version, userId) || locationGeneration.current !== generation || remainingMs() <= 0)
        return;
      if (
        ![point.latitude, point.longitude, point.accuracy].every(Number.isFinite) ||
        Math.abs(point.latitude) > 90 ||
        Math.abs(point.longitude) > 180 ||
        point.accuracy < 0
      )
        throw new BrowserLocationError(2);
      position.current = point;
      setFlow((old) => ({ ...old, phase: 'READY_TO_CONFIRM', message: '' }));
    } catch (error) {
      if (!valid(controller, version, userId) || locationGeneration.current !== generation || remainingMs() <= 0)
        return;
      const code = error instanceof BrowserLocationError ? error.code : 0;

      setFlow((old) => ({
        ...old,
        phase: 'READY_FOR_LOCATION',
        message:
          code === 1
            ? 'Permiso de ubicación denegado. Activa el permiso de ubicación del navegador e inténtalo nuevamente, o solicita ayuda a tu auxiliar.'
            : code === 3
              ? 'La ubicación tardó demasiado. Inténtalo nuevamente mientras la autorización esté vigente.'
              : 'No se pudo obtener una ubicación válida. Verifica que utilizas HTTPS y un navegador compatible, o solicita ayuda a tu auxiliar.',
      }));
    } finally {
      finish(controller);
    }
  };

  const confirm = async () => {
    if (
      !entry ||
      !userId ||
      !allowed ||
      !['READY', 'READY_TO_CONFIRM'].includes(currentFlow.current.phase) ||
      currentFlow.current.retryAt > Date.now() ||
      currentFlow.current.mark ||
      (currentFlow.current.context?.mode === 'GEOLOCATION_QR'
        ? !authorization.current || !position.current || remainingMs() <= 0
        : !token.current) ||
      operation.current
    )
      return;
    const version = entry.sequence;
    const identity = userId;
    const controller = begin();

    setFlow((old) => ({ ...old, phase: 'SUBMITTING', message: '' }));

    try {
      const combined = currentFlow.current.context?.mode === 'GEOLOCATION_QR';

      const result = combined
        ? await checkInCombined(
            entry.id,
            { authorization: authorization.current!.value, ...position.current! },
            controller.signal,
          )
        : await checkInWithQr(entry.id, token.current!, controller.signal);

      if (!valid(controller, version, identity)) return;
      if (
        result.code !== 'SUCCESS' ||
        result.status !== 'PRESENT' ||
        result.registrationMethod !== (combined ? 'GEOLOCATION_QR' : 'QR')
      )
        throw new Error('Invalid check-in response');
      clearCombined();
      forget();
      setFlow((old) => ({
        ...old,
        phase: 'SUCCESS',
        mark: result,
        message: 'Asistencia registrada correctamente',
        retryAt: 0,
      }));
    } catch (error) {
      if (!valid(controller, version, identity) || axios.isCancel(error)) return;
      const code = attendanceQrErrorCode(error);

      if (currentFlow.current.context?.mode === 'GEOLOCATION_QR') {
        position.current = null;

        if (
          (['LOW_ACCURACY', 'OUTSIDE_AREA', 'LOCATION_INVALID'].includes(code ?? '') ||
            (axios.isAxiosError(error) && error.response?.status === 429)) &&
          remainingMs() > 0
        ) {
          setFlow((old) => ({
            ...old,
            phase: 'READY_FOR_LOCATION',
            message: studentQrError(error),
            retryAt: qrRetryAfter(error),
          }));

          return;
        }

        clearCombined();
      }

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        loginRef.current();

        return;
      }

      if (
        code === 'ALREADY_REGISTERED' ||
        code === 'SESSION_CLOSED' ||
        code === 'SESSION_CANCELLED' ||
        qrUncertainFailure(error)
      ) {
        forget();
        const retryAt = qrRetryAfter(error);

        setFlow((old) => ({ ...old, phase: 'UNCERTAIN', message: uncertain, retryAt }));
        if (retryAt > Date.now()) return;

        try {
          await reconcile(
            entry.id,
            controller,
            version,
            identity,
            code === 'SESSION_CLOSED' ? studentQrError(error) + ' ' + uncertain : uncertain,
          );
        } catch (cause) {
          if (valid(controller, version, identity))
            setFlow((old) => ({
              ...old,
              message: uncertain + ' ' + studentQrError(cause),
              retryAt: qrRetryAfter(cause),
            }));
        }
      } else {
        if (qrRequiresRescan(error)) forget();
        setFlow((old) => ({
          ...old,
          phase: code === 'QR_TOKEN_EXPIRED' || code === 'COMBINED_AUTHORIZATION_EXPIRED' ? 'EXPIRED' : 'ERROR',
          message: studentQrError(error),
          retryAt: qrRetryAfter(error),
        }));
      }
    } finally {
      finish(controller);
    }
  };

  const readOwn = async () => {
    if (!entry || !userId || !allowed || operation.current || currentFlow.current.retryAt > Date.now()) return;
    const controller = begin();

    clearCombined();
    setFlow((old) => ({ ...old, phase: 'UNCERTAIN' }));
    setReading(true);

    try {
      await reconcile(
        entry.id,
        controller,
        entry.sequence,
        userId,
        'No aparece una marca propia en esta consulta. Si hubo un envío previo, todavía podría completarse. Vuelve a consultar o escanea un código vigente.',
      );
    } catch (error) {
      if (valid(controller, entry.sequence, userId))
        setFlow((old) => ({ ...old, message: studentQrError(error), retryAt: qrRetryAfter(error) }));
    } finally {
      finish(controller);
      if (alive.current && sequence.current === entry.sequence) setReading(false);
    }
  };

  const abandon = () => {
    clearCombined();
    requests.current.forEach((request) => request.abort());
    sequence.current += 1;
    forget();
    router.push('/dashboard');
  };

  const visible = owner.current && owner.current !== userId && (flow.context || flow.mark) ? initial : flow;

  return {
    ...visible,
    reading,
    remaining,
    locate,
    login,
    confirm,
    retryContext: loadContext,
    readOwn,
    abandon,
    hasToken: !!token.current,
    canRead: !!entry && !!userId && allowed,
    rateLimited: flow.retryAt > Math.max(clock, Date.now()),
  };
}
