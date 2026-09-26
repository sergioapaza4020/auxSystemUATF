import { PartialType } from '@nestjs/swagger';
import { EnrollmentCreateDto } from './enrollments.dto';

export class EnrollmentUpdateDto extends PartialType(EnrollmentCreateDto, {
  skipNullProperties: false,
}) {}
