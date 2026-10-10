// UI percentages only; persisted permissionWeight and academic calculations remain normalized.
export function permissionWeightToPercentage(weight: number): number {
  return Number((weight * 100).toPrecision(15));
}

export function parsePermissionPercentage(value: string): number {
  const input = value.trim();

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return Number.NaN;

  const percentage = Number(input);

  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
    ? Number((percentage / 100).toPrecision(15))
    : Number.NaN;
}
