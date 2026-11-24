import { describe, expect, it } from 'vitest';

import {
  combinedAttendanceError,
  isProtectedAttendance,
  manualReasonError,
  mayHaveSavedAttendance,
  normalizeManualReason,
} from './attendance-combined';

describe('combined auxiliary policy', () => {
  it.each(['', '   ', '\u200b\u200d\ufeff', '..............', '123456789', 'a b c d e f g h i'])(
    'rejects a reason without ten useful characters: %j',
    (value) => {
      expect(manualReasonError(value)).not.toBe('');
    },
  );
  it.each(['GPS sin respuesta en aula', '1234567890', 'Estudiante sin teléfono', 'Áéíóúñ1234'])(
    'accepts a specific useful reason: %s',
    (value) => expect(manualReasonError(value)).toBe(''),
  );
  it('rejects oversized input and normalizes format characters consistently', () => {
    expect(manualReasonError('a'.repeat(501))).not.toBe('');
    expect(manualReasonError('a'.repeat(500))).toBe('');
    expect(normalizeManualReason('  GPS\u200b sin respuesta  ')).toBe('GPS sin respuesta');
  });
  it.each(['GEOLOCATION', 'QR', 'GEOLOCATION_QR'] as const)('protects %s', (method) =>
    expect(isProtectedAttendance(method)).toBe(true),
  );
  it('keeps manual as the only editable method', () => expect(isProtectedAttendance('MANUAL')).toBe(false));
  it.each([
    'MANUAL_REASON_REQUIRED',
    'MANUAL_OVERRIDE_FORBIDDEN',
    'ATTENDANCE_EVIDENCE_PROTECTED',
    'SESSION_CLOSED',
    'NOT_ENROLLED',
  ])('maps %s without leaking server details', (code) => {
    const error = { isAxiosError: true, response: { status: 409, data: { code, message: 'SQL secret' } } };

    expect(combinedAttendanceError(error)).not.toContain('SQL');
    expect(mayHaveSavedAttendance(error)).toBe(false);
  });
  it.each([undefined, 500, 503, 408])('treats an ambiguous response as requiring reconciliation (%s)', (status) => {
    expect(mayHaveSavedAttendance({ isAxiosError: true, response: status ? { status } : undefined })).toBe(true);
  });
});
