import { ApiProperty } from '@nestjs/swagger';
import { AttendanceSessionLifecycleResponseDto } from './attendance-session-lifecycle-response.dto';

export class AttendanceSessionResponseDto extends AttendanceSessionLifecycleResponseDto {
  @ApiProperty()
  pendingCount: number;
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
