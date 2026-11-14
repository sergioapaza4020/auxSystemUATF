import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceCheckInDto } from './attendance-check-in.dto';

describe('Check-in input contract', () => {
  it.each([
    { latitude: 90, longitude: 180, accuracy: 0 },
    { latitude: -90, longitude: -180, accuracy: 50 },
  ])('accepts finite bounds %#', (values) => {
    expect(validateSync(plainToInstance(AttendanceCheckInDto, values))).toEqual([]);
  });
  it.each([
    { latitude: 91 },
    { latitude: -91 },
    { longitude: 181 },
    { longitude: -181 },
    { latitude: NaN },
    { longitude: Infinity },
    { accuracy: Infinity },
    { accuracy: -1 },
    { latitude: '0' },
    { longitude: '0' },
    { accuracy: '20' },
    { latitude: null },
    { accuracy: null },
    { longitude: undefined },
  ])('rejects invalid location values %#', (values) => {
    expect(
      validateSync(
        plainToInstance(AttendanceCheckInDto, {
          latitude: 0,
          longitude: 0,
          accuracy: 20,
          ...values,
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    'enrollmentId',
    'idEnrollment',
    'status',
    'idUser',
    'registrationMethod',
    'markedAt',
    'markedBy',
    'distanceMeters',
  ])('does not whitelist %s', (field) => {
    expect(
      validateSync(
        plainToInstance(AttendanceCheckInDto, {
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          [field]: 1,
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ).length,
    ).toBeGreaterThan(0);
  });
});
