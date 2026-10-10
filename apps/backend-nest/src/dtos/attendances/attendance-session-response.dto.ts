import { ApiProperty } from '@nestjs/swagger';

export class AttendanceSessionResponseDto {
  @ApiProperty()
  idAttendanceSession: number;
  @ApiProperty()
  date: Date;
  @ApiProperty()
  presentCount: number;
  @ApiProperty()
  excusedCount: number;
  @ApiProperty()
  absentCount: number;
  @ApiProperty()
  totalStudents: number;
  @ApiProperty()
  percentage: number;
}
