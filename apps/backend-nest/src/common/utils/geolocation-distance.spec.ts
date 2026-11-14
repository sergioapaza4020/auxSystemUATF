import { calculateDistanceMeters } from './geolocation-distance';

describe('Haversine distance in metres', () => {
  it('returns zero for the same point', () => {
    expect(calculateDistanceMeters(-19.5723, -65.755, -19.5723, -65.755)).toBe(0);
  });
  it('measures one degree along the equator', () => {
    expect(calculateDistanceMeters(0, 0, 0, 1)).toBeCloseTo(111194.9266, 3);
  });
  it('handles negative latitudes and is symmetric', () => {
    const distance = calculateDistanceMeters(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(distance).toBeGreaterThan(710000);
    expect(distance).toBeLessThan(715000);
    expect(calculateDistanceMeters(-37.8136, 144.9631, -33.8688, 151.2093)).toBeCloseTo(
      distance,
      8,
    );
  });
  it('crosses the antimeridian using the short distance', () => {
    expect(calculateDistanceMeters(0, 179.999, 0, -179.999)).toBeCloseTo(222.3899, 3);
  });
  it('remains finite near antipodal points', () => {
    expect(calculateDistanceMeters(0, 0, 0, 180)).toBeCloseTo(20015086.796, 2);
  });
  it.each([NaN, Infinity, -Infinity, 91, -91])('rejects invalid latitude %s', (latitude) => {
    expect(() => calculateDistanceMeters(latitude, 0, 0, 0)).toThrow(RangeError);
  });
  it.each([181, -181])('rejects invalid longitude %s', (longitude) => {
    expect(() => calculateDistanceMeters(0, longitude, 0, 0)).toThrow(RangeError);
  });
});
