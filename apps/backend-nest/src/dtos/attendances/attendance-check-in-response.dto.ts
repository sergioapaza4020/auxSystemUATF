import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendanceRegistrationMethod } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceCheckInCode } from '@common/enums/attendanceCheckInCode';

export class AttendanceCheckInResponseDto {
  @ApiProperty({ enum: [AttendanceCheckInCode.SUCCESS] })
  code: AttendanceCheckInCode.SUCCESS;
  @ApiProperty()
  idAttendance: number;
  @ApiProperty({ enum: [AttendanceStatus.PRESENT] })
  status: AttendanceStatus.PRESENT;
  @ApiProperty({ enum: [AttendanceRegistrationMethod.GEOLOCATION] })
  registrationMethod: AttendanceRegistrationMethod.GEOLOCATION;
  @ApiProperty()
  markedAt: Date;
}
