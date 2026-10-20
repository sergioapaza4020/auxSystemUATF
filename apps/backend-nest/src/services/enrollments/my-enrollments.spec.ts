import { In, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CourseRelations } from '@common/enums/courseRelations';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { SemestersService } from '../semesters/semesters.service';
import { EnrollmentsService } from './enrollments.service';

function fixture() {
  const rows = [CourseRelations.STUDENT, CourseRelations.ASSISTANT].map((role, index) => ({
    idEnrollment: index + 1,
    role,
    course: { code: 'SIS' },
  }));
  const repository = { find: jest.fn().mockResolvedValue(rows) };
  const users = { getOneById: jest.fn().mockResolvedValue({ idUser: 5 }) };
  const semesters = { getCurrentSemester: jest.fn().mockResolvedValue({ idSemester: 20 }) };
  const service = new EnrollmentsService(
    repository as unknown as Repository<Enrollment>,
    users as unknown as UsersService,
    semesters as unknown as SemestersService,
    {} as CoursesService,
  );
  return { service, repository, semesters, users, rows };
}
describe('Current own enrollments', () => {
  it('retains both roles and queries only the owning user and current semester', async () => {
    const f = fixture();
    expect(await f.service.getUserEnrollments(5, true)).toEqual(f.rows);
    expect(f.repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: { idUser: 5 },
          semester: { idSemester: 20 },
          isActive: true,
          role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
        },
        relations: { course: true, semester: true },
      }),
    );
    const options: unknown = f.repository.find.mock.calls[0];
    expect(JSON.stringify(options)).not.toContain('gradeScheme');
    expect(JSON.stringify(options)).not.toContain('activities');
  });
  it('returns no current enrollments when no current semester exists, without falling back to history', async () => {
    const f = fixture();
    f.semesters.getCurrentSemester.mockRejectedValue(new NotFoundException());
    expect(await f.service.getUserEnrollments(5, true)).toEqual([]);
    expect(f.repository.find).not.toHaveBeenCalled();
  });
  it('does not hide database errors as an empty current semester', async () => {
    const f = fixture();
    f.semesters.getCurrentSemester.mockRejectedValue(new Error('database'));
    await expect(f.service.getUserEnrollments(5, true)).rejects.toThrow('database');
  });
  it('rejects an inactive or nonexistent user before querying enrollments', async () => {
    const f = fixture();
    f.users.getOneById.mockResolvedValue(null);
    await expect(f.service.getUserEnrollments(99, true)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.repository.find).not.toHaveBeenCalled();
  });
  it('preserves the legacy all-semesters contract when current is omitted', async () => {
    const f = fixture();
    expect(await f.service.getUserEnrollments(5)).toEqual(f.rows);
    expect(f.semesters.getCurrentSemester).not.toHaveBeenCalled();
    expect(f.repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: {
          user: true,
          semester: true,
          course: { gradeScheme: { details: { gradeItem: true, activities: true } } },
        },
      }),
    );
  });
});
