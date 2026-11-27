import { describe, expect, it, vi } from 'vitest';

import {
  changeOwnPassword,
  confirmEmailChange,
  getOwnSessions,
  requestEmailChange,
  revokeOwnSessions,
  updateOwnProfile,
} from './account-settings.service';
import { instance } from './config/config';

vi.mock('./config/config', () => ({ instance: { patch: vi.fn(), get: vi.fn(), post: vi.fn() } }));

describe('API de configuración de cuenta', () => {
  const signal = new AbortController().signal;

  it('sends profile edits scoped to the active session and reads the confirmed email', async () => {
    const fields = { name: 'María José', lastname: 'Núñez' };
    const data = { ...fields, email: 'confirmado@test.invalid' };

    vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data } });
    await expect(updateOwnProfile(71, fields, signal)).resolves.toEqual(data);
    expect(instance.patch).toHaveBeenCalledWith('/auth/me', fields, { params: { expectedSession: 71 }, signal });
  });

  it('puts credentials and verification token only in separate POST bodies', async () => {
    const data = { newEmail: 'pending@test.invalid', expiresAt: '2030-01-01T00:00:00Z' };
    const options = { params: { expectedSession: 71 }, signal, timeout: 25000 };

    vi.mocked(instance.post).mockResolvedValue({ data: { data } });
    await expect(requestEmailChange(71, data.newEmail, 'password', signal)).resolves.toEqual(data);
    expect(instance.post).toHaveBeenCalledWith(
      '/users/me/email-change',
      {
        newEmail: data.newEmail,
        currentPassword: 'password',
      },
      options,
    );
    await confirmEmailChange(71, 'test-token', signal);
    expect(instance.post).toHaveBeenCalledWith('/users/email-change/confirm', { token: 'test-token' }, options);
  });

  it('uses the active-session scope and passes cancellation and pagination', async () => {
    const response = { data: [], meta: { total: 0 } };

    vi.mocked(instance.get).mockResolvedValue({ data: response });
    await expect(getOwnSessions(71, 2, 5, signal)).resolves.toEqual(response);
    expect(instance.get).toHaveBeenCalledWith('/sessions/me', {
      params: { expectedSession: 71, page: 2, limit: 5 },
      signal,
    });
  });

  it('uses separate paths for individual and bulk revocation', async () => {
    await revokeOwnSessions(71, signal, 84);
    await revokeOwnSessions(71, signal);
    const options = { params: { expectedSession: 71 }, signal };

    expect(instance.patch).toHaveBeenCalledWith('/sessions/me/others/84', undefined, options);
    expect(instance.patch).toHaveBeenCalledWith('/sessions/me/others', undefined, options);
  });

  it('sends the current and replacement passwords only in the request body', async () => {
    const data = { currentPassword: 'old-test-value', newPassword: 'new-test-value' };

    await changeOwnPassword(71, data, signal);
    expect(instance.patch).toHaveBeenCalledWith('/auth/me/password', data, { params: { expectedSession: 71 }, signal });
  });
});
