import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class AttendanceOpenNowDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Whole minutes from the server opening instant' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  durationMinutes?: number;
}
