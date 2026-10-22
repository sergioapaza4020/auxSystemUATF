/** JWT configuration uses explicit, whole units; jsonwebtoken receives seconds. */
export function jwtDurationSeconds(value: string | undefined, variable: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value?.trim() ?? '');
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = match ? Number(match[1]) * units[match[2]] : 0;

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      `${variable} must be a positive duration with an explicit unit (e.g. 15m, 1h, 7d)`,
    );
  }

  return seconds;
}
