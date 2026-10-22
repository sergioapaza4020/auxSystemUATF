import { JwtService } from '@nestjs/jwt';
import { jwtDurationSeconds } from './jwt-duration';

describe('JWT duration configuration', () => {
  it.each([
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
  ])('signs %s with a lifetime of %i seconds', (value, expected) => {
    const jwt = new JwtService({ secret: 'duration-test-only' });
    const token = jwt.sign({}, { expiresIn: jwtDurationSeconds(value, 'JWT_DURATION') });
    const payload = jwt.verify<{ iat: number; exp: number }>(token);
    expect(payload.exp - payload.iat).toBe(expected);
  });

  it.each([undefined, '', '900', '0s', '-1h', '1.5h', 'invalid', '999999999999999999999d'])(
    'rejects invalid or ambiguous duration %s',
    (value) => {
      expect(() => jwtDurationSeconds(value, 'JWT_DURATION')).toThrow('JWT_DURATION must be');
    },
  );
});
