import { CourseRelations } from '@common/enums/courseRelations';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches } from 'class-validator';

export class EnrollmentCreateDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  @Matches(/^(I|II)-\d{4}$/i)
  semester: string;

  @ApiProperty()
  @IsString()
  courseCode: string;

  @ApiProperty()
  @IsEnum(CourseRelations)
  role: CourseRelations;
}
