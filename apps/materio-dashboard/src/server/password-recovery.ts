import 'server-only';

import { isIP } from 'node:net';
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { configuration } from './auth-handler';

const apiPath = '/api/auth/password-recovery';

export const resetPath = '/forgot-password/reset';
const flowCookie = 'uatf_recovery_flow';

export const proofCookie = 'uatf_recovery_proof';
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const idPattern = new RegExp('^' + uuid + '$');
const proofPattern = new RegExp('^(' + uuid + ')\\.([a-f0-9]{64})\\.(\\d{13})\\.([a-f0-9]{64})$');
const retryMessage = 'No pudimos completar la recuperación. Inténtalo nuevamente.';
const accepted = 'Si el correo está asociado a una cuenta, recibirás un código de recuperación.';

type Operation = 'request' | 'resend' | 'verify' | 'reset';

function signProof(value: string, key: string) {
  return createHmac('sha256', Buffer.from(key, 'hex')).update('uatf-recovery-cookie\0').update(value).digest('hex');
}

function readProof(value: string, key: string) {
  const match = proofPattern.exec(value);

  if (!match) return null;
  const [, id, proof, expiry, signature] = match;
  const expected = signProof(`${id}.${proof}.${expiry}`, key);

  if (Number(expiry) <= Date.now() || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')))
    return null;

  return { id, proof };
}

export function hasRecoveryProof(value: string) {
  try {
    return Boolean(readProof(value, configuration().transportKey));
  } catch {
    return false;
  }
}

function reply(status: number, message: string, retryAfter?: number) {
  return NextResponse.json(
    { message, retryAfter },
    { status, headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' } },
  );
}

function setCookie(response: NextResponse, name: string, value: string, path: string, secure: boolean, maxAge: number) {
  response.cookies.set(name, value, { path, secure, httpOnly: true, sameSite: 'strict', maxAge });
}

function flow(request: NextRequest) {
  const value = request.cookies.get(flowCookie)?.value ?? '';
  const split = value.indexOf(':');
  const id = value.slice(0, split);
  const email = value.slice(split + 1);

  return idPattern.test(id) && email.length <= 254 ? { id, email } : null;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader();

  if (!reader) return null;

  const decoder = new TextDecoder();
  let raw = '';
  let size = 0;

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;
    size += value.byteLength;

    if (size > 2048) {
      await reader.cancel();

      return null;
    }

    raw += decoder.decode(value, { stream: true });
  }

  const parsed: unknown = JSON.parse(raw + decoder.decode());

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

export async function handleRecovery(request: NextRequest, operation: Operation) {
  try {
    const config = configuration();

    if (
      request.headers.get('origin') !== config.publicUrl.origin ||
      request.headers.get('host') !== config.publicUrl.host ||
      request.headers.get('x-uatf-csrf') !== '1' ||
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    ) {
      return reply(403, 'Origen o protección CSRF inválidos.');
    }

    const input = await readBody(request).catch(() => null);

    if (!input) return reply(400, 'Solicitud inválida.');

    const current = flow(request);
    const proof = readProof(request.cookies.get(proofCookie)?.value ?? '', config.transportKey);
    const isRequest = operation === 'request' || operation === 'resend';
    let body: Record<string, string>;

    if (isRequest) {
      const email = operation === 'request' ? input.email : current?.email;

      if (typeof email !== 'string' || !email.trim() || email.trim().length > 254) {
        return reply(400, 'Ingresa un correo electrónico válido.');
      }

      body = { email: email.trim().toLowerCase() };
    } else if (operation === 'verify') {
      const id = input.id === undefined ? current?.id : input.id;

      if (
        typeof id !== 'string' ||
        !idPattern.test(id) ||
        typeof input.code !== 'string' ||
        !/^\d{6}$/.test(input.code)
      ) {
        return reply(400, 'Ingresa los seis dígitos o solicita un nuevo código.');
      }

      body = { id, code: input.code };
    } else {
      if (!proof || typeof input.password !== 'string' || input.password.length > 72) {
        return reply(400, 'La autorización o la contraseña no es válida.');
      }

      body = { ...proof, password: input.password };
    }

    const ipHeader = process.env.PASSWORD_RECOVERY_CLIENT_IP_HEADER;
    const ip = ipHeader ? request.headers.get(ipHeader) : null;

    const upstream = await fetch(`${config.apiUrl.origin}${apiPath}/${isRequest ? 'request' : operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uatf-auth-transport': config.transportKey,
        ...(ip && isIP(ip) ? { 'x-uatf-client-ip': ip } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return reply(429, 'Demasiados intentos. Inténtalo más tarde.');
      if (upstream.status !== 400) return reply(503, retryMessage);
      const error = await upstream.json();
      const message = typeof error?.message === 'string' ? error.message : 'Revisa los datos e inténtalo nuevamente.';

      return reply(400, message);
    }

    if (operation === 'reset') {
      const response = reply(200, 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.');

      setCookie(response, proofCookie, '', resetPath, config.secure, 0);

      return response;
    }

    const { data } = await upstream.json();

    if (isRequest && typeof data?.id === 'string' && idPattern.test(data.id)) {
      const response = reply(202, accepted, 60);

      setCookie(response, flowCookie, data.id + ':' + body.email, apiPath, config.secure, 3600);

      return response;
    }

    if (
      operation === 'verify' &&
      typeof data?.proof === 'string' &&
      /^[a-f0-9]{64}$/.test(data.proof) &&
      Number.isInteger(data.maxAge) &&
      data.maxAge > 0 &&
      data.maxAge <= 600
    ) {
      const response = reply(200, 'Código verificado.');

      setCookie(response, flowCookie, '', apiPath, config.secure, 0);
      const value = `${body.id}.${data.proof}.${Date.now() + data.maxAge * 1000}`;

      setCookie(
        response,
        proofCookie,
        value + '.' + signProof(value, config.transportKey),
        resetPath,
        config.secure,
        data.maxAge,
      );

      return response;
    }

    return reply(503, retryMessage);
  } catch {
    return reply(503, retryMessage);
  }
}
