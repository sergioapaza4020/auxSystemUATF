import { HttpStatus } from '@nestjs/common';
import { AttendanceCheckInException } from '../errors/attendance-check-in.exception';
import { AttendanceCheckInCode as Code } from '../enums/attendanceCheckInCode';
import { calculateDistanceMeters } from './geolocation-distance';
import type { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import type { AttendanceCheckInDto } from 'src/dtos/attendances/attendance-check-in.dto';

/** Shared GEO/COMB policy: compare raw values before rounding persisted evidence. */
export function attendanceLocationEvidence(session: AttendanceSession, dto: AttendanceCheckInDto) {
  const latitude = Number(session.latitude);
  const longitude = Number(session.longitude);
  if (
    session.latitude == null ||
    session.longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  )
    throw new AttendanceCheckInException(
      Code.SESSION_CONTEXT_INVALID,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  if (dto.accuracy > session.maximumAcceptedAccuracy!)
    throw new AttendanceCheckInException(Code.LOW_ACCURACY, HttpStatus.UNPROCESSABLE_ENTITY);
  const distance = calculateDistanceMeters(latitude, longitude, dto.latitude, dto.longitude);
  if (distance > session.radiusMeters!)
    throw new AttendanceCheckInException(Code.OUTSIDE_AREA, HttpStatus.UNPROCESSABLE_ENTITY);
  const accuracy = dto.accuracy.toFixed(2);
  if (Number(accuracy) > 99_999_999.99)
    throw new AttendanceCheckInException(Code.LOCATION_INVALID, HttpStatus.BAD_REQUEST);
  return { accuracy, distanceMeters: distance.toFixed(2) };
}
