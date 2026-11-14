import { describe, expect, it, vi, afterEach } from 'vitest';

import { studentQrError, qrRequiresRescan, qrRetryAfter, qrUncertainFailure } from './student-qr-errors';

const error = (code: string, status = 409, headers = {}) => ({
  isAxiosError: true,
  response: { status, data: { code }, headers },
});

afterEach(() => vi.useRealTimers());
describe('student QR safe error contract', () => {
  it.each([
    'QR_TOKEN_EXPIRED',
    'QR_TOKEN_INVALID',
    'QR_NOT_AVAILABLE',
    'SESSION_CLOSED',
    'SESSION_CANCELLED',
    'SESSION_NOT_STARTED',
    'ALREADY_REGISTERED',
    'NOT_ENROLLED',
    'SESSION_CONTEXT_INVALID',
  ])('maps %s safely', (code) => {
    expect(studentQrError(error(code))).not.toContain(code);
    expect(qrRequiresRescan(error(code))).toBe(true);
  });
  it('does not echo unknown backend text or confuse forbidden with expiration', () => {
    expect(studentQrError(error('q1.secret.signature', 500))).not.toContain('q1.secret');
    expect(studentQrError(error('QR_TOKEN_EXPIRED', 403))).toContain('permiso');
  });
  it('separates network/5xx uncertainty from a known rejection', () => {
    expect(qrUncertainFailure(new Error('timeout'))).toBe(true);
    expect(qrUncertainFailure(error('', 503))).toBe(true);
    expect(qrUncertainFailure(error('QR_TOKEN_EXPIRED', 400))).toBe(false);
  });
  it('respects both Retry-After seconds and dates and has a safe missing-header delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T14:00:00Z'));
    expect(qrRetryAfter(error('', 429, { 'retry-after': '20' }))).toBe(Date.now() + 20000);
    expect(qrRetryAfter(error('', 429, { 'retry-after': 'Thu, 12 Nov 2026 14:01:00 GMT' }))).toBe(Date.now() + 60000);
    expect(qrRetryAfter(error('', 429))).toBe(Date.now() + 30000);
  });
});
