import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusQueryDto } from '../common/status-query.dto';

export class AssistantSchemeQueryDto extends StatusQueryDto {
  @ApiPropertyOptional({ description: 'Matrícula del auxiliar; identifica curso y semestre' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  enrollmentId?: number;
}
