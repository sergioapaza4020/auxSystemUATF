import { afterEach, describe, expect, it, vi } from 'vitest';

import { attendanceCheckInErrorCode, getAttendanceCheckInErrorMessage } from './attendance-check-in';
import { BrowserLocationError, getCurrentBrowserPosition } from './browser-geolocation';

afterEach(() => vi.unstubAllGlobals());
describe('private check-in errors and browser helper', () => {
  it.each([
    'OUTSIDE_AREA',
    'LOW_ACCURACY',
    'SESSION_NOT_STARTED',
    'SESSION_CLOSED',
    'SESSION_CANCELLED',
    'SESSION_NOT_GEOLOCATION',
    'NOT_ENROLLED',
    'ALREADY_REGISTERED',
    'LOCATION_INVALID',
    'SESSION_CONTEXT_INVALID',
    'SESSION_NOT_FOUND',
  ])('maps %s without disclosing server details', (code) => {
    const error = {
      isAxiosError: true,
      response: { data: { code, message: 'secret center latitude radius distance' } },
    };

    expect(attendanceCheckInErrorCode(error)).toBe(code);
    expect(getAttendanceCheckInErrorMessage(error)).not.toMatch(/secret|latitude|radius|distance/);
  });
  it('distinguishes permission 403 and 429 from outside area', () => {
    expect(getAttendanceCheckInErrorMessage({ isAxiosError: true, response: { status: 403 } })).toContain('permiso');
    expect(getAttendanceCheckInErrorMessage({ isAxiosError: true, response: { status: 429 } })).toContain('Espera');
    expect(getAttendanceCheckInErrorMessage(new Error('latitude=secret'))).not.toContain('secret');
  });
  it.each([0, 1, 2, 3])('maps browser error %s separately from domain failures', (code) => {
    expect(getAttendanceCheckInErrorMessage(new BrowserLocationError(code))).toMatch(/ubicación/);
  });
  it('passes the exact position without additional fields or rounding', async () => {
    const getCurrentPosition = vi.fn((accept: PositionCallback) =>
      accept({ coords: { latitude: 1.123456789, longitude: -2.123456789, accuracy: 0 } } as GeolocationPosition),
    );

    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    expect(await getCurrentBrowserPosition()).toEqual({ latitude: 1.123456789, longitude: -2.123456789, accuracy: 0 });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
  it('normalizes synchronous browser failures', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: () => {
          throw new Error('blocked');
        },
      },
    });
    await expect(getCurrentBrowserPosition()).rejects.toBeInstanceOf(BrowserLocationError);
  });
});
