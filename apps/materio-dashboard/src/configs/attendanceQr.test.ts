import { describe, expect, it } from 'vitest';

import { attendanceQrOrigin, attendanceQrUrl } from './attendanceQr';

describe('Trusted mobile QR destination', () => {
  it.each([
    '',
    'http://uatf.test',
    'https://localhost',
    'https://localhost.',
    'https://127.0.0.1',
    'https://192.168.1.2',
    'https://[::1]',
    'https://portal.local',
    'https://portal.internal',
    'https://u:p@uatf.test',
    'https://uatf.test/path',
    'https://uatf.test/?t=secret',
    'https://uatf.test/#hash',
    'not-a-url',
  ])('refuses %s', (value) => {
    expect(attendanceQrOrigin(value)).toBeNull();
  });
  it('uses only an explicit HTTPS origin and puts the temporary token in a fragment', () => {
    expect(attendanceQrOrigin('https://academico.uatf.test/')).toBe('https://academico.uatf.test');
    expect(attendanceQrUrl('https://academico.uatf.test', 'q1.synthetic')).toBe(
      'https://academico.uatf.test/attendance/qr#t=q1.synthetic',
    );
    expect(() => attendanceQrUrl('https://uatf.test/other', 'token')).toThrow();
  });
});
