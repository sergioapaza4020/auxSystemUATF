import { AttendanceRegistrationMethod as Method } from '../enums/attendanceRegistrationMethod';

export function isProtectedAttendanceEvidence(method: Method): boolean {
  return method === Method.GEOLOCATION || method === Method.QR || method === Method.GEOLOCATION_QR;
}
