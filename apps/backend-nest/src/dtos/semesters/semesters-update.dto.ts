import { PartialType } from '@nestjs/swagger';
import { SemesterCreateDto } from './semesters.dto';

export class SemesterUpdateDto extends PartialType(SemesterCreateDto, {
  skipNullProperties: false,
}) {}
