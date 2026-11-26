import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const REFRESH_COOKIE = 'uatf_refresh';
const PENDING_LOGOUT = 'uatf_logout_pending';

type Operation = 'login' | 'refresh' | 'logout';
type Credentials = { accessToken: string; refreshToken: string; sessionExpiresAt: string; rememberMe: boolean | null };

export function configuration() {
  const publicUrl = new URL(process.env.AUTH_PUBLIC_ORIGIN ?? 'http://localhost:3000');
  const apiUrl = new URL(process.env.AUTH_API_ORIGIN ?? 'http://localhost:3001');
  const transportKey = process.env.AUTH_TRANSPORT_KEY;
  const production = process.env.NODE_ENV === 'production';

  if (!transportKey || !/^[a-f0-9]{64}$/.test(transportKey)) throw new Error('Invalid auth transport key');

  for (const url of [publicUrl, apiUrl]) {
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('Invalid auth origin');
    if (production && url.protocol !== 'https:') throw new Error('HTTPS auth origins required');
    if (!production && url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Unsafe development origin');
  }

  return { publicUrl, apiUrl, transportKey, secure: publicUrl.protocol === 'https:' };
}

function reply(status: number, message: string, data?: { accessToken: string }) {
  return NextResponse.json(
    { status: status < 400, message, ...(data ? { data } : {}) },
    {
      status,
      headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer' },
    },
  );
}

function clear(response: NextResponse, name: string, secure: boolean) {
  response.cookies.set(name, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}

async function upstream(config: ReturnType<typeof configuration>, operation: Operation, body: object) {
  return fetch(`${config.apiUrl.origin}/api/auth/session/${operation}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-uatf-auth-transport': config.transportKey },
    body: JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
}

function credentials(value: unknown): Credentials | null {
  if (!value || typeof value !== 'object' || !('data' in value)) return null;
  const data = value.data;

  if (!data || typeof data !== 'object') return null;
  if (
    !('accessToken' in data) ||
    typeof data.accessToken !== 'string' ||
    !data.accessToken ||
    !('refreshToken' in data) ||
    typeof data.refreshToken !== 'string' ||
    !data.refreshToken ||
    !('sessionExpiresAt' in data) ||
    typeof data.sessionExpiresAt !== 'string' ||
    !Number.isFinite(Date.parse(data.sessionExpiresAt)) ||
    Date.parse(data.sessionExpiresAt) <= Date.now() ||
    !('rememberMe' in data) ||
    ![true, false, null].includes(data.rememberMe as boolean | null)
  )
    return null;

  return data as Credentials;
}

/** Only transport lives here; Nest remains the issuer and session authority. */
export async function handleAuth(request: NextRequest, operation: Operation): Promise<NextResponse> {
  let config: ReturnType<typeof configuration>;

  try {
    config = configuration();
  } catch {
    return reply(503, 'Configuración de autenticación no disponible.');
  }

  const { publicUrl, secure } = config;

  // Never trust forwarded Host/Origin values or an arbitrary CORS origin.
  if (
    request.headers.get('origin') !== publicUrl.origin ||
    request.headers.get('host') !== publicUrl.host ||
    request.headers.get('x-uatf-csrf') !== '1' ||
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    return reply(403, 'Origen o protección CSRF inválidos.');
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (raw.length > 8192) return reply(413, 'Solicitud demasiado grande.');
    body = JSON.parse(raw);
  } catch {
    return reply(400, 'Solicitud inválida.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'Solicitud inválida.');

  // Cookie migration happens server-side; legacy refresh never enters client JavaScript.
  const current = request.cookies.get(REFRESH_COOKIE)?.value ?? request.cookies.get('refreshToken')?.value;
  const pending = request.cookies.get(PENDING_LOGOUT)?.value;

  try {
    if (pending) {
      const revocation = await upstream(config, 'logout', { refreshToken: pending });

      if (!revocation.ok && revocation.status !== 401)
        return reply(
          503,
          operation === 'login'
            ? 'Servicio de autenticación temporalmente no disponible. Reintenta.'
            : 'No se pudo confirmar el cierre anterior. Reintenta cerrar sesión.',
        );
    }

    if (operation === 'logout') {
      if (current) {
        let revoked = false;

        try {
          const result = await upstream(config, 'logout', { refreshToken: current });

          revoked = result.ok || result.status === 401;
        } catch {
          /* Preserve proof only in HttpOnly retry cookie below. */
        }

        if (!revoked) {
          const response = reply(
            503,
            'Sesión cerrada localmente; revocación remota pendiente. Reintenta cerrar sesión.',
          );

          response.cookies.set(PENDING_LOGOUT, current, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
          for (const name of [REFRESH_COOKIE, 'refreshToken', 'accessToken']) clear(response, name, secure);

          return response;
        }
      }

      const response = reply(200, 'Sesión cerrada.');

      for (const name of [REFRESH_COOKIE, PENDING_LOGOUT, 'refreshToken', 'accessToken']) clear(response, name, secure);

      return response;
    }

    if (operation === 'refresh' && !current) return reply(401, 'Inicia sesión nuevamente.');

    if (operation === 'login') {
      if (
        !('username' in body) ||
        typeof body.username !== 'string' ||
        !('password' in body) ||
        typeof body.password !== 'string' ||
        ('rememberMe' in body && typeof body.rememberMe !== 'boolean')
      )
        return reply(400, 'Datos de acceso inválidos.');
    }

    const payload =
      operation === 'login'
        ? {
            username: (body as { username: string }).username,
            password: (body as { password: string }).password,
            rememberMe: 'rememberMe' in body ? body.rememberMe : false,
          }
        : { refreshToken: current };

    const result = await upstream(config, operation, payload);

    if (!result.ok) {
      if (result.status === 403) return reply(503, 'Servicio de autenticación temporalmente no disponible.');

      // No Set-Cookie on a losing refresh: it must not erase a winner's newer cookie.
      return reply(
        result.status === 401 ? 401 : result.status === 409 ? 409 : result.status >= 500 ? 503 : 400,
        result.status === 401
          ? 'Credenciales inválidas o sesión vencida.'
          : 'No se pudo completar la autenticación. Reintenta.',
      );
    }

    const data = credentials(await result.json());

    if (!data) return reply(502, 'Respuesta de autenticación inválida.');
    const expires = new Date(data.sessionExpiresAt);
    const persistent = data.rememberMe !== false; // null is legacy: original capped deadline, never +30d.
    const response = reply(200, 'Autenticación completada.', { accessToken: data.accessToken });

    response.cookies.set(REFRESH_COOKIE, data.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      ...(persistent ? { expires, maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)) } : {}),
    });
    for (const name of [PENDING_LOGOUT, 'refreshToken', 'accessToken']) clear(response, name, secure);

    return response;
  } catch {
    return reply(503, 'Servicio de autenticación temporalmente no disponible. Reintenta.');
  }
}
