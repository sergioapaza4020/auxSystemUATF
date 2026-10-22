import { isIPv4 } from 'node:net';

export function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  if (ip === '::1') return '127.0.0.1';

  if (ip.toLowerCase().startsWith('::ffff:')) {
    const ipv4 = ip.slice(7);
    if (isIPv4(ipv4)) return ipv4;
  }

  return ip;
}
