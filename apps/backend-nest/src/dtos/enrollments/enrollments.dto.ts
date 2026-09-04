import { CourseRelations } from '@common/enums/courseRelations';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class EnrollmentCreateDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  semester: string;

  @ApiProperty()
  @IsString()
  courseCode: string;

  @ApiProperty()
  @IsEnum(CourseRelations)
  role: CourseRelations;
}
