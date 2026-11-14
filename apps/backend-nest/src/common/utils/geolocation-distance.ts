// Mean spherical Earth radius in metres. Appropriate for campus-sized geofences;
// this is a distance estimate, not proof that browser coordinates are authentic.
export const EARTH_RADIUS_METERS = 6_371_000;

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  for (const [value, limit] of [
    [lat1, 90],
    [lat2, 90],
    [lon1, 180],
    [lon2, 180],
  ])
    if (!Number.isFinite(value) || Math.abs(value) > limit)
      throw new RangeError('Invalid geographic coordinate');
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, a));
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}
