import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AttendanceQrTokenDto {
  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  token: string;
}

export class AttendanceQrConfigDto {
  @ApiProperty({ description: 'ISO instant with explicit Z or offset' })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt: string;

  @ApiProperty({ description: 'ISO instant with explicit Z or offset' })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt: string;
}
