import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

describe('Public authentication navigation', () => {
  it.each([
    '/login',
    '/verify-account',
    '/forgot-password',
    '/forgot-password/verify',
    '/forgot-password/reset',
    '/forgot-password/reset/submit',
  ])('allows %s without a session', (path) => {
    expect(middleware(new NextRequest(`http://localhost${path}`)).headers.get('location')).toBeNull();
  });

  it('still protects dashboard routes', () => {
    expect(middleware(new NextRequest('http://localhost/dashboard')).headers.get('location')).toBe(
      'http://localhost/login',
    );
  });
});

describe('exact public QR entry', () => {
  it('opens the entry without JWT with privacy headers', () => {
    const response = middleware(new NextRequest('https://uatf.test/attendance/qr'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it.each(['/attendance', '/attendance/qr/other', '/attendance/qr-evil', '/dashboard'])(
    'does not expose %s',
    (path) => {
      expect(middleware(new NextRequest(`https://uatf.test${path}`)).headers.get('location')).toBe(
        'https://uatf.test/login',
      );
    },
  );
});
