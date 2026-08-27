import { CourseRelations } from '@common/enums/courseRelations';
import { IsEnum, IsNumber } from 'class-validator';

export class EnrollmentCreateDto {
  @IsNumber()
  idUser: number;

  @IsNumber()
  idSemester: number;

  @IsNumber()
  idCourse: number;

  @IsEnum(CourseRelations)
  role: CourseRelations;
}
