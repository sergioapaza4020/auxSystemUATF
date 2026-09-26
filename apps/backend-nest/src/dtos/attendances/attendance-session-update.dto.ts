import { PickType } from '@nestjs/swagger';
import { AttendanceSessionCreateDto } from './attendance-session-create.dto';

export class AttendanceSessionUpdateDto extends PickType(AttendanceSessionCreateDto, [
  'date',
] as const) {}
