import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class AttendanceSessionTopicDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase() === 'sin tema'
        ? null
        : value.trim() || null
      : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(255)
  topic?: string | null;
}
