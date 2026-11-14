'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import axios from 'axios';

import { checkInWithQr, getMyQrMark, getQrContext } from '@/api/attendances.service';
import { useAuth } from '@/hooks/useAuth';
import type { IQrContext, IQrOwnMark } from '@/interfaces/attendances/student-qr.interface';
import { hasPermission } from '@/utils/hasPermission';
import { getAccessToken, getRefreshToken } from '@/utils/authCookies';
import { clearPendingQr, parseQrFragment, savePendingQr, saveQrReview, takePendingQr } from '@/utils/student-qr-flow';
import { attendanceQrErrorCode } from '@/utils/attendance-qr';
import { qrRequiresRescan, qrRetryAfter, qrUncertainFailure, studentQrError } from '@/utils/student-qr-errors';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

export type StudentQrPhase =
  | 'INITIALIZING'
  | 'AUTH_REQUIRED'
  | 'LOADING_CONTEXT'
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
      pendingRequests.forEach((request) => request.abort());
      pendingRequests.clear();
      operation.current = null;
      if (!handoff.current) clearPendingQr();
      window.removeEventListener('hashchange', changed);
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    };
  }, []);

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

      const context = await getQrContext(entry.id, token.current!, controller.signal);

      if (!valid(controller, version, identity)) return;
      if (context.idAttendanceSession !== entry.id || context.state !== 'OPEN') throw new Error('Invalid context');

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
        phase: code === 'QR_TOKEN_EXPIRED' ? 'EXPIRED' : 'ERROR',
        message,
        retryAt: qrRetryAfter(error),
      }));

      if (code === 'SESSION_CLOSED' || code === 'ALREADY_REGISTERED') {
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

    authenticated.current = userId;

    if (!allowed) {
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
  }, [entry, verified, userId, allowed, forget]);

  // Context has no serverNow: avoid a countdown based on the phone's clock.
  // Backend tokens have at most 35s of validity; bound memory lifetime without extending it.
  useEffect(() => {
    if (!entry) return;

    const timer = setTimeout(() => {
      if (!alive.current || handoff.current || !token.current) return;
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

  const confirm = async () => {
    if (
      !entry ||
      !userId ||
      !allowed ||
      currentFlow.current.phase !== 'READY' ||
      currentFlow.current.mark ||
      !token.current ||
      operation.current
    )
      return;
    const version = entry.sequence;
    const identity = userId;
    const controller = begin();

    setFlow((old) => ({ ...old, phase: 'SUBMITTING', message: '' }));

    try {
      const result = await checkInWithQr(entry.id, token.current, controller.signal);

      if (!valid(controller, version, identity)) return;
      if (result.code !== 'SUCCESS' || result.status !== 'PRESENT' || result.registrationMethod !== 'QR')
        throw new Error('Invalid check-in response');
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

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        loginRef.current();

        return;
      }

      if (code === 'ALREADY_REGISTERED' || code === 'SESSION_CLOSED' || qrUncertainFailure(error)) {
        forget();
        setFlow((old) => ({ ...old, phase: 'UNCERTAIN', message: uncertain }));

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
          phase: code === 'QR_TOKEN_EXPIRED' ? 'EXPIRED' : 'ERROR',
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
    forget();
    router.push('/dashboard');
  };

  const visible = owner.current && owner.current !== userId && (flow.context || flow.mark) ? initial : flow;

  return {
    ...visible,
    reading,
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
