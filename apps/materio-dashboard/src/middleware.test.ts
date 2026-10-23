import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

describe('Public account verification navigation', () => {
  it.each(['/login', '/verify-account'])('allows %s without a session', (path) => {
    expect(middleware(new NextRequest(`http://localhost${path}`)).headers.get('location')).toBeNull();
  });

  it('still protects dashboard routes', () => {
    expect(middleware(new NextRequest('http://localhost/dashboard')).headers.get('location')).toBe(
      'http://localhost/login',
    );
  });
});
