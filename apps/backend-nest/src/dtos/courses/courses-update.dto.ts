import { PartialType } from '@nestjs/swagger';
import { CourseCreateDto } from './courses.dto';

export class CourseUpdateDto extends PartialType(CourseCreateDto, { skipNullProperties: false }) {}
