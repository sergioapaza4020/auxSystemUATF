import { normalizeIp } from './normalize-ip';

describe('normalizeIp', () => {
  it.each([
    ['::ffff:192.168.1.25', '192.168.1.25'],
    ['::FFFF:10.0.0.5', '10.0.0.5'],
    ['::1', '127.0.0.1'],
    ['192.168.1.25', '192.168.1.25'],
    ['2001:db8::1', '2001:db8::1'],
    ['2001:db8::1234', '2001:db8::1234'],
    ['::ffff:invalid', '::ffff:invalid'],
    ['::ffff:192.168.1.999', '::ffff:192.168.1.999'],
    [null, null],
    [undefined, null],
    ['', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });
});
