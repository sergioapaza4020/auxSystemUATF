import { describe, expect, it } from 'vitest';

import { attendanceQrError, qrUnavailable } from './attendance-qr';

const failure = (code: string, status = 409) => ({ isAxiosError: true, response: { status, data: { code } } });

describe('safe QR errors', () => {
  it.each([
    'SESSION_CLOSED',
    'SESSION_CANCELLED',
    'SESSION_NOT_STARTED',
    'QR_NOT_AVAILABLE',
    'SESSION_NOT_FOUND',
    'SESSION_CONTEXT_INVALID',
  ])('stops presentation on %s', (code) => {
    expect(qrUnavailable(failure(code))).toBe(true);
    expect(attendanceQrError(failure(code))).not.toContain(code);
  });
  it('does not expose unrecognized backend messages or tokens', () => {
    const error = { isAxiosError: true, response: { status: 500, data: { message: 'q1.secret.signature' } } };

    expect(attendanceQrError(error)).not.toContain('q1.secret');
    expect(qrUnavailable(error)).toBe(false);
    expect(qrUnavailable(failure('', 403))).toBe(true);
    expect(attendanceQrError(failure('', 429))).toContain('Espera');
  });
});
