import { ApiProperty } from '@nestjs/swagger';

export class StudentAttendanceResponseDto {
  @ApiProperty()
  totalSessions: number;
  @ApiProperty()
  presentSessions: number;
  @ApiProperty()
  excusedSessions: number;
  @ApiProperty()
  absentSessions: number;
  @ApiProperty()
  percentage: number;
}
