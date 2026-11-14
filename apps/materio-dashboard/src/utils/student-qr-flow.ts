// QR is a shared temporary challenge, never an authentication credential.
export const QR_PENDING_KEY = 'uatf.attendance.qr.login.v1';
const RETENTION_MS = 10 * 60 * 1000;

export function parseQrToken(value: unknown): { token: string; id: number } | null {
  if (typeof value !== 'string' || value.length > 128) return null;
  const match = /^q1\.([A-Za-z0-9_-]{1,16})\.([1-9]\d{0,9})\.(0|[1-9]\d{0,11})\.([A-Za-z0-9_-]{43})$/.exec(value);

  if (!match) return null;
  const id = Number(match[2]);

  return Number.isSafeInteger(id) && id <= 2147483647 ? { token: value, id } : null;
}

export function parseQrFragment(hash: string) {
  if (!hash.startsWith('#') || hash.length > 512) return null;
  const params = new URLSearchParams(hash.slice(1));
  const entries = [...params.entries()];

  return entries.length === 1 && entries[0][0] === 't' ? parseQrToken(entries[0][1]) : null;
}

export function clearPendingQr() {
  try {
    window.sessionStorage.removeItem(QR_PENDING_KEY);
  } catch {
    /* Storage can be disabled. */
  }
}

export function savePendingQr(token: string): boolean {
  clearPendingQr();
  if (!parseQrToken(token)) return false;

  try {
    window.sessionStorage.setItem(QR_PENDING_KEY, JSON.stringify({ token, savedAt: Date.now(), resume: true }));

    return true;
  } catch {
    return false;
  }
}

// A receipt reference carries no token and can only resume an authorized own-mark read.
export function saveQrReview(id: number): boolean {
  clearPendingQr();
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return false;

  try {
    window.sessionStorage.setItem(
      QR_PENDING_KEY,
      JSON.stringify({ token: null, id, review: true, savedAt: Date.now(), resume: true }),
    );

    return true;
  } catch {
    return false;
  }
}

function pendingQr() {
  try {
    const raw = window.sessionStorage.getItem(QR_PENDING_KEY);

    if (!raw) return null;
    const data: unknown = JSON.parse(raw);

    if (
      !data ||
      typeof data !== 'object' ||
      !('token' in data) ||
      !('savedAt' in data) ||
      !('resume' in data) ||
      typeof data.savedAt !== 'number' ||
      !Number.isFinite(data.savedAt) ||
      typeof data.resume !== 'boolean' ||
      Date.now() - data.savedAt > RETENTION_MS ||
      data.savedAt > Date.now() + 60000
    ) {
      clearPendingQr();

      return null;
    }

    if (
      'review' in data &&
      data.review === true &&
      data.token === null &&
      'id' in data &&
      typeof data.id === 'number' &&
      Number.isSafeInteger(data.id) &&
      data.id > 0 &&
      data.id <= 2147483647
    ) {
      return { token: null, id: data.id, review: true as const, savedAt: data.savedAt, resume: data.resume };
    }

    const parsed = parseQrToken(data.token);

    if (!parsed) {
      clearPendingQr();

      return null;
    }

    return { ...parsed, savedAt: data.savedAt, resume: data.resume };
  } catch {
    clearPendingQr();

    return null;
  }
}

export function takePendingQr() {
  const value = pendingQr();

  clearPendingQr();

  return value
    ? 'review' in value
      ? { token: null, id: value.id, review: true as const }
      : { token: value.token, id: value.id }
    : null;
}

// Fixed destinations only. Neither a query string nor storage can specify a URL.
export function qrLoginDestination(): '/attendance/qr' | '/dashboard' {
  const value = pendingQr();

  if (!value?.resume) return '/dashboard';

  try {
    window.sessionStorage.setItem(QR_PENDING_KEY, JSON.stringify({ ...value, resume: false }));
  } catch {
    clearPendingQr();

    return '/dashboard';
  }

  return '/attendance/qr';
}
