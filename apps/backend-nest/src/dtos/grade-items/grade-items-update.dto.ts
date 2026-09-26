import { PartialType } from '@nestjs/swagger';
import { GradeItemCreateDto } from './grade-items.dto';

export class GradeItemUpdateDto extends PartialType(GradeItemCreateDto, {
  skipNullProperties: false,
}) {}
