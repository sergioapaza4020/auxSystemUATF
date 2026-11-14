import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingQr,
  parseQrFragment,
  parseQrToken,
  QR_PENDING_KEY,
  qrLoginDestination,
  savePendingQr,
  saveQrReview,
  takePendingQr,
} from './student-qr-flow';
import { memorySessionStorage, qrToken } from '@/test-utils/qr-fixtures';

beforeEach(() => {
  vi.stubGlobal('window', { sessionStorage: memorySessionStorage() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('QR entry and temporary login transfer', () => {
  it('extracts only a bounded route reference, never authenticates the signature', () => {
    expect(parseQrToken(qrToken())).toEqual({ token: qrToken(), id: 7 });
    expect(parseQrFragment(`#t=${qrToken()}`)).toEqual({ token: qrToken(), id: 7 });
  });
  it.each([
    '',
    '#',
    '#t=',
    '#t=q1.invalid',
    '#t=' + 'A'.repeat(129),
    '#x=' + qrToken(),
    '#t=' + qrToken() + '&t=' + qrToken(),
    '#t=' + qrToken() + '&returnTo=https://evil.test',
    '#t=' + qrToken(2147483648),
    '#t=' + qrToken().replace('.7.', '.07.'),
  ])('rejects malformed or ambiguous fragment %s', (hash) => {
    expect(parseQrFragment(hash)).toBeNull();
  });
  it('transfers across login only once and clears storage on adoption', () => {
    expect(qrLoginDestination()).toBe('/dashboard');
    expect(savePendingQr(qrToken())).toBe(true);
    expect(qrLoginDestination()).toBe('/attendance/qr');
    expect(qrLoginDestination()).toBe('/dashboard');
    expect(takePendingQr()).toEqual({ token: qrToken(), id: 7 });
    expect(window.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('replaces the previous challenge and clears on abandonment', () => {
    savePendingQr(qrToken());
    savePendingQr(qrToken(8));
    expect(takePendingQr()?.id).toBe(8);
    savePendingQr(qrToken());
    clearPendingQr();
    expect(takePendingQr()).toBeNull();
  });
  it.each([
    '{}',
    'invalid',
    JSON.stringify({ token: qrToken(), savedAt: 0, resume: true }),
    JSON.stringify({ token: 'https://evil.test', savedAt: Date.now(), resume: true }),
  ])('does not accept arbitrary login destinations or corrupt storage', (raw) => {
    window.sessionStorage.setItem(QR_PENDING_KEY, raw);
    expect(qrLoginDestination()).toBe('/dashboard');
    expect(takePendingQr()).toBeNull();
  });
  it('bounds retention but does not extend token cryptographic validity during login', () => {
    vi.useFakeTimers();
    savePendingQr(qrToken());
    vi.advanceTimersByTime(600001);
    expect(qrLoginDestination()).toBe('/dashboard');
    expect(window.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('can transfer only a receipt reference after discarding a challenge', () => {
    expect(saveQrReview(7)).toBe(true);
    expect(qrLoginDestination()).toBe('/attendance/qr');
    expect(takePendingQr()).toEqual({ token: null, id: 7, review: true });
    expect(saveQrReview(-1)).toBe(false);
  });
  it('fails safely when session storage is disabled', () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('blocked');
      },
    });
    expect(savePendingQr(qrToken())).toBe(false);
    expect(qrLoginDestination()).toBe('/dashboard');
    expect(takePendingQr()).toBeNull();
  });
});
