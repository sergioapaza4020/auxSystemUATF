'use client';

import { useEffect, useRef, useState } from 'react';

import axios from 'axios';

import { getAttendanceQrCode } from '@/api/attendances.service';
import type { IAttendanceLifecycle, IAttendanceQrCode } from '@/interfaces/attendances/attendance.interface';
import { attendanceQrError, qrUnavailable } from '@/utils/attendance-qr';

type Code = { data: IAttendanceQrCode; wall: number; monotonic: number; roundTrip: number };

export function useAttendanceQr(
  session: IAttendanceLifecycle & { idAttendanceSession: number },
  enabled: boolean,
  onUnavailable: () => void,
) {
  const [code, setCode] = useState<Code | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [valid, setValid] = useState(false);
  const retry = useRef<() => void>(() => undefined);
  const callback = useRef(onUnavailable);

  callback.current = onUnavailable;
  const id = session.idAttendanceSession;
  const open = enabled && session.mode === 'QR' && session.state === 'OPEN';

  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;
    let current: Code | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rotated = '';
    let terminal = false;
    let failed = false;
    let generation = 0;

    setCode(null);
    setError('');
    setValid(false);
    setRemaining(0);
    setFetching(false);

    const elapsed = (value: Code) => Math.max(0, performance.now() - value.monotonic, Date.now() - value.wall);

    const tick = () => {
      if (!active || !open || terminal) return;

      if (current) {
        const age = elapsed(current);
        const time = Date.parse(current.data.serverNow) + age;
        const expires = Date.parse(current.data.expiresAt);

        // Full RTT is a conservative upper estimate of age at receipt. Never extend expiry.
        const stillValid = time + current.roundTrip < expires;

        setValid(stillValid);
        setRemaining(Math.max(0, Math.ceil((Date.parse(current.data.rotateAt) - time) / 1000)));

        if (time >= Date.parse(current.data.rotateAt) && rotated !== current.data.rotateAt && !failed) {
          rotated = current.data.rotateAt;
          void fetchCode();
        }

        if (!stillValid) {
          current = null;
          setCode(null);
        }
      }

      timer = setTimeout(tick, 250);
    };

    const fetchCode = async () => {
      if (!active || !open || terminal || request) return;
      const controller = new AbortController();
      const version = ++generation;
      const start = performance.now();

      request = controller;
      setFetching(true);
      setError('');
      failed = false;

      try {
        const data = await getAttendanceQrCode(id, controller.signal);

        if (!active || controller.signal.aborted || version !== generation) return;
        const server = Date.parse(data.serverNow);
        const rotate = Date.parse(data.rotateAt);
        const expires = Date.parse(data.expiresAt);
        const roundTrip = Math.max(0, performance.now() - start);

        if (
          data.idAttendanceSession !== id ||
          typeof data.token !== 'string' ||
          !data.token ||
          data.token.length > 128 ||
          ![server, rotate, expires].every(Number.isFinite) ||
          rotate <= server ||
          expires < rotate ||
          server + roundTrip >= expires
        )
          throw new Error('Invalid QR response');
        current = { data, wall: Date.now(), monotonic: performance.now(), roundTrip };
        setCode(current);
        setValid(true);
        setRemaining(Math.max(0, Math.ceil((rotate - server) / 1000)));
      } catch (cause) {
        if (!active || controller.signal.aborted || version !== generation || axios.isCancel(cause)) return;
        failed = true;
        setError(qrUnavailable(cause) ? attendanceQrError(cause) : 'No se pudo actualizar el código QR.');

        if (qrUnavailable(cause)) {
          terminal = true;
          current = null;
          setCode(null);
          setValid(false);
          callback.current();
        }
      } finally {
        if (active && version === generation) {
          request = null;
          setFetching(false);
        }
      }
    };

    const resume = () => {
      if (document.visibilityState === 'hidden') return;

      // A suspended performance clock or a changed wall clock must not revive a code.
      request?.abort();
      request = null;
      generation += 1;
      current = null;
      setCode(null);
      setValid(false);
      if (!terminal) void fetchCode();
    };

    retry.current = () => {
      if (!terminal) void fetchCode();
    };

    if (open) {
      void fetchCode();
      tick();
      window.addEventListener('focus', resume);
      window.addEventListener('online', resume);
      document.addEventListener('visibilitychange', resume);
    }

    return () => {
      active = false;
      generation += 1;
      request?.abort();
      current = null;
      if (timer) clearTimeout(timer);
      retry.current = () => undefined;
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [id, open]);

  return {
    code: open && valid && code?.data.idAttendanceSession === id ? code.data : null,
    fetching: open && fetching,
    remaining,
    error: open ? error : '',
    retry: () => retry.current(),
  };
}
