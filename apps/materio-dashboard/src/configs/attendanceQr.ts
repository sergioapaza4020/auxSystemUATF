// Build-time configuration only. Never infer a public mobile URL from the browser origin.
export function attendanceQrOrigin(value = process.env.NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !host.includes('.') ||
      host.includes(':') ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal)$/.test(host)
    )
      return null;

    return url.origin;
  } catch {
    return null;
  }
}

export function attendanceQrUrl(origin: string, token: string): string {
  if (attendanceQrOrigin(origin) !== origin || !token || token.length > 128)
    throw new Error('No se pudo preparar el código QR.');

  return `${origin}/attendance/qr#t=${encodeURIComponent(token)}`;
}
