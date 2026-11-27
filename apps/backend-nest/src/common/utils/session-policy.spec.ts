import { UnauthorizedException } from '@nestjs/common';
import { remainingSeconds, sessionDeadline } from './session-policy';

describe('session policy', () => {
  it('assigns absolute 12 hour and 30 day deadlines by default', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(sessionDeadline(false, now).getTime() - now.getTime()).toBe(12 * 60 * 60 * 1000);
    expect(sessionDeadline(true, now).getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('rejects configuration beyond each absolute maximum', () => {
    const originalSession = process.env.AUTH_SESSION_TTL;
    const originalRemembered = process.env.AUTH_REMEMBERED_SESSION_TTL;
    process.env.AUTH_SESSION_TTL = '13h';
    process.env.AUTH_REMEMBERED_SESSION_TTL = '31d';
    try {
      expect(() => sessionDeadline(false, new Date())).toThrow();
      expect(() => sessionDeadline(true, new Date())).toThrow();
    } finally {
      if (originalSession === undefined) delete process.env.AUTH_SESSION_TTL;
      else process.env.AUTH_SESSION_TTL = originalSession;
      if (originalRemembered === undefined) delete process.env.AUTH_REMEMBERED_SESSION_TTL;
      else process.env.AUTH_REMEMBERED_SESSION_TTL = originalRemembered;
    }
  });

  it('limits refresh issuance to the remaining absolute session time', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      expect(remainingSeconds(new Date(1_002_500))).toBe(2);
      expect(() => remainingSeconds(new Date(999_999))).toThrow(UnauthorizedException);
    } finally {
      now.mockRestore();
    }
  });
});
