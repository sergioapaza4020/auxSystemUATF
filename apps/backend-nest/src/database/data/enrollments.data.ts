import { CourseRelations } from '@common/enums/courseRelations';
import { EnrollmentSeed } from '../interfaces/enrollments.interface';

export const enrollmentsData: EnrollmentSeed[] = [
  {
    user: 'nenas',
    semester: 'II-2026',
    courseCode: 'SIS-313',
    courseGroup: 2,
    role: CourseRelations.ASSISTANT,
  },
  {
    user: 'david-blade',
    semester: 'II-2026',
    courseCode: 'SIS-313',
    courseGroup: 2,
    role: CourseRelations.TEACHER,
  },
  {
    user: 'boris',
    semester: 'II-2026',
    courseCode: 'SIS-313',
    courseGroup: 2,
    role: CourseRelations.STUDENT,
  },
];
