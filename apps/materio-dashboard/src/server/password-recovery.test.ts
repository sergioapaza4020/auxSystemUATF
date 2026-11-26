import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleRecovery, hasRecoveryProof, proofCookie, resetPath } from './password-recovery';

vi.mock('server-only', () => ({}));

const id = '12345678-aaaa-4aaa-aaaa-123456789abc';
const proof = 'd'.repeat(64);
const origin = 'https://sigad.test';
const api = 'https://api.sigad.test';
const flowCookie = 'uatf_recovery_flow';
const email = 'person@test.invalid';

function input(body: object, options: { path?: string; origin?: string; cookie?: [string, string] } = {}) {
  const req = new NextRequest(origin + (options.path ?? '/api/auth/password-recovery/request'), {
    method: 'POST',
    headers: {
      origin: options.origin ?? origin,
      host: 'sigad.test',
      'x-uatf-csrf': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (options.cookie) req.cookies.set(...options.cookie);

  return req;
}

beforeEach(() => {
  vi.stubEnv('AUTH_PUBLIC_ORIGIN', origin);
  vi.stubEnv('AUTH_API_ORIGIN', api);
  vi.stubEnv('AUTH_TRANSPORT_KEY', 'a'.repeat(64));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('password recovery transport', () => {
  it('requires same-origin requests and rejects oversized payloads before contacting Nest', async () => {
    const upstream = vi.fn();

    vi.stubGlobal('fetch', upstream);

    expect((await handleRecovery(input({ email }, { origin: 'https://elsewhere.test' }), 'request')).status).toBe(403);
    expect((await handleRecovery(input({ email, extra: 'x'.repeat(3000) }), 'request')).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps the recovery id in an HttpOnly cookie and reuses the request endpoint for resend', async () => {
    const upstream = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ data: { id } }, { status: 202 })));

    vi.stubGlobal('fetch', upstream);

    const first = await handleRecovery(input({ email: email.toUpperCase() }), 'request');

    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({
      message: 'Si el correo está asociado a una cuenta, recibirás un código de recuperación.',
      retryAfter: 60,
    });
    expect(first.cookies.get(flowCookie)).toMatchObject({ httpOnly: true, sameSite: 'strict', secure: true });

    const resent = await handleRecovery(input({}, { cookie: [flowCookie, id + ':' + email] }), 'resend');

    expect(resent.status).toBe(202);
    expect(upstream.mock.calls.map(([url]) => url)).toEqual(Array(2).fill(api + '/api/auth/password-recovery/request'));
    expect(upstream.mock.calls.map(([, config]) => JSON.parse(config.body))).toEqual([{ email }, { email }]);
  });

  it('scopes the proof cookie to reset, hides it in JSON and clears it after success', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { proof, maxAge: 450 } }))
      .mockResolvedValueOnce(Response.json({ status: true }));

    vi.stubGlobal('fetch', upstream);

    const verified = await handleRecovery(
      input({ code: '012345' }, { cookie: [flowCookie, id + ':' + email] }),
      'verify',
    );

    expect(verified.status).toBe(200);
    expect(await verified.json()).toEqual({ message: 'Código verificado.' });
    expect(verified.cookies.get(proofCookie)).toMatchObject({
      path: resetPath,
      maxAge: 450,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    const signed = verified.cookies.get(proofCookie)?.value ?? '';

    expect(hasRecoveryProof(signed)).toBe(true);
    expect(hasRecoveryProof(id + '.' + proof)).toBe(false);
    const password = 'Password8!';
    const path = resetPath + '/submit';

    expect((await handleRecovery(input({ password, proof, id }, { path }), 'reset')).status).toBe(400);
    const reset = await handleRecovery(input({ password }, { path, cookie: [proofCookie, signed] }), 'reset');

    expect(reset.status).toBe(200);
    expect(reset.cookies.get(proofCookie)).toMatchObject({ path: resetPath, maxAge: 0 });
    expect(JSON.parse(upstream.mock.calls[1][1].body)).toEqual({ password, proof, id });
    expect(await reset.text()).not.toContain(proof);
  });

  it('maps a Nest recovery configuration failure to a generic 503', async () => {
    const fetchRecovery = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: 'La recuperación no está disponible temporalmente.' }, { status: 503 }),
      );

    vi.stubGlobal('fetch', fetchRecovery);

    const response = await handleRecovery(input({ email }), 'request');

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({ message: 'No pudimos completar la recuperación. Inténtalo nuevamente.' });
    expect(fetchRecovery).toHaveBeenCalledWith(
      api + '/api/auth/password-recovery/request',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('verifies a code from an administrative email without a request cookie', async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ data: { proof, maxAge: 450 } }));

    vi.stubGlobal('fetch', upstream);

    const invalid = await handleRecovery(input({ id: 'invalid', code: '012345' }), 'verify');

    expect(invalid.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();

    const verified = await handleRecovery(input({ id, code: '012345' }), 'verify');

    expect(verified.status).toBe(200);
    expect(await verified.json()).toEqual({ message: 'Código verificado.' });
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({ id, code: '012345' });
    expect(verified.cookies.get(proofCookie)).toMatchObject({ httpOnly: true, path: resetPath });
  });
});
