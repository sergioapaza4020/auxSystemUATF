import { CourseRelations } from '@common/enums/courseRelations';

export interface EnrollmentSeed {
  user: string;
  semester: string;
  courseCode: string;
  role: CourseRelations;
}
