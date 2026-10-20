import { Repository } from 'typeorm';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { CourseRelations } from '@common/enums/courseRelations';
import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';

// The caller must validate ownership before building the scoped roster.
export function buildStudentRosterQuery(
  repository: Repository<Enrollment>,
  assistant: Enrollment,
  search?: string,
) {
  const query = repository
    .createQueryBuilder('student')
    .innerJoinAndSelect('student.user', 'user')
    .where('student.id_course = :courseId', { courseId: assistant.course.idCourse })
    .andWhere('student.id_semester = :semesterId', { semesterId: assistant.semester.idSemester })
    .andWhere('student.role = :role', { role: CourseRelations.STUDENT })
    .andWhere('student.isActive = true');
  if (search?.trim())
    query.andWhere(
      "(concat_ws(' ', user.name, user.lastname) ILIKE :search OR concat_ws(' ', user.lastname, user.name) ILIKE :search OR user.ci ILIKE :search OR user.ru ILIKE :search OR user.username ILIKE :search)",
      { search: `%${search.trim().replace(/[\\%_]/g, '\\$&')}%` },
    );
  return query
    .orderBy('user.lastname', 'ASC')
    .addOrderBy('user.name', 'ASC')
    .addOrderBy('student.idEnrollment', 'ASC');
}

export async function getStudentRosterPage(
  repository: Repository<Enrollment>,
  assistant: Enrollment,
  query: StudentRosterQueryDto,
) {
  const { page = 1, limit = 25 } = query;
  const [data, total] = await buildStudentRosterQuery(repository, assistant, query.search)
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
