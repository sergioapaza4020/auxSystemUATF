import { getPendingEmail } from '@/api/account-settings.service';
import type { PendingEmailChange } from '@/interfaces/auth/account-settings.interface';

export function watchPendingEmail(
  idSession: number,
  publish: (request: PendingEmailChange | null, sent: boolean) => void,
) {
  let current: PendingEmailChange | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lookup: AbortController | undefined;
  let disposed = false;
  let submitting = false;

  function scheduleExpiry(remaining: number) {
    timer = setTimeout(expire, Math.min(remaining, 2_147_483_647));
  }

  function setCurrent(request: PendingEmailChange | null, sent = false) {
    if (disposed) return;
    clearTimeout(timer);
    const remaining = request ? Date.parse(request.expiresAt) - Date.now() : 0;

    current = remaining > 0 ? request : null;
    publish(current, sent && Boolean(current));
    if (current) scheduleExpiry(remaining);
  }

  function expire() {
    if (!current || disposed) return;
    const remaining = Date.parse(current.expiresAt) - Date.now();

    if (remaining > 0) scheduleExpiry(remaining);
    else revalidate();
  }

  function revalidate() {
    if (disposed) return;
    if (current && Date.parse(current.expiresAt) <= Date.now()) setCurrent(null);
    if (submitting || lookup) return;
    const controller = new AbortController();

    lookup = controller;
    void getPendingEmail(idSession, controller.signal)
      .then((request) => {
        if (!controller.signal.aborted) setCurrent(request);
      })
      .catch(() => undefined)
      .finally(() => {
        if (lookup === controller) lookup = undefined;
      });
  }

  function onVisible() {
    if (document.visibilityState === 'visible') revalidate();
  }

  window.addEventListener('focus', revalidate);
  document.addEventListener('visibilitychange', onVisible);
  revalidate();

  return {
    beginSubmission() {
      submitting = true;
      lookup?.abort();
      lookup = undefined;
    },
    finishSubmission(request?: PendingEmailChange) {
      submitting = false;
      if (request) setCurrent(request, true);
      else revalidate();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      lookup?.abort();
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
