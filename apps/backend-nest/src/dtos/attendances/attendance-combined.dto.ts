import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { AttendanceCheckInDto } from './attendance-check-in.dto';

export class AttendanceCombinedCheckInDto extends AttendanceCheckInDto {
  @ApiProperty({
    minLength: 43,
    maxLength: 43,
    description: 'Opaque canonical Base64URL authorization',
  })
  @IsString()
  @Length(43, 43)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  authorization: string;
}
