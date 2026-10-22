import axios, { AxiosError, CanceledError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
