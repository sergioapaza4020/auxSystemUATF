import axios, { AxiosError, CanceledError } from 'axios';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { savePendingQr, qrLoginDestination } from '@/utils/student-qr-flow';
import { memorySessionStorage, qrToken } from '@/test-utils/qr-fixtures';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

import { instance } from './config';
import { refreshAccessToken } from '../auth.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

vi.mock('@/utils/authCookies', () => ({ getAccessToken: () => undefined, clearTokens: vi.fn() }));
vi.mock('../auth.service', () => ({ refreshAccessToken: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Axios response cancellation', () => {
  it('does not log or refresh intentional AbortController cancellation', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const controller = new AbortController();

    const pending = instance.get('/matrix-probe', {
      signal: controller.signal,
      adapter: (config) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener?.('abort', () => reject(new CanceledError('canceled')));
        }),
    });

    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toSatisfy(axios.isCancel);
    expect(log).not.toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
  it('continues logging real HTTP failures and retains the backend message', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const pending = instance.get('/matrix-probe', {
      adapter: (config) =>
        Promise.reject(
          new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
            data: { message: 'La matrícula no pertenece a esta materia.' },
            status: 403,
            statusText: 'Forbidden',
            headers: {},
            config,
          }),
        ),
    });

    const error: unknown = await pending.catch((reason) => reason);

    expect(log).toHaveBeenCalledWith('Response error:', 403);
    expect(getApiErrorMessage(error)).toBe('La matrícula no pertenece a esta materia.');
  });
  it('preserves useful local confirmation errors instead of hiding them behind a generic message', () => {
    expect(
      getApiErrorMessage(new Error('La respuesta de guardado está incompleta. Tus cambios se conservan.')),
    ).toContain('incompleta');
    expect(getApiErrorMessage({})).toBe('Ha ocurrido un error inesperado');
  });
});

it('preserves QR transfer synchronously before failed refresh navigates to ordinary login', async () => {
  const browser = Object.assign(new EventTarget(), {
    location: { href: '/attendance/qr' },
    sessionStorage: memorySessionStorage(),
  });

  vi.stubGlobal('window', browser);
  browser.addEventListener(SESSION_EXPIRED_EVENT, () => {
    savePendingQr(qrToken());
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  vi.mocked(refreshAccessToken).mockRejectedValueOnce(
    Object.assign(new Error('expired refresh'), {
      isAxiosError: true,
      response: { status: 401 },
    }),
  );
  await expect(
    instance.post(
      '/attendances/sessions/7/qr-context',
      { token: qrToken() },
      {
        adapter: (config) =>
          Promise.reject(
            new AxiosError('Unauthorized', '', config, undefined, {
              data: {},
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              config,
            }),
          ),
      },
    ),
  ).rejects.toThrow('expired refresh');
  expect(browser.location.href).toBe('/login');
  expect(qrLoginDestination()).toBe('/attendance/qr');
  expect(JSON.stringify(log.mock.calls)).not.toContain(qrToken());
  vi.unstubAllGlobals();
});
