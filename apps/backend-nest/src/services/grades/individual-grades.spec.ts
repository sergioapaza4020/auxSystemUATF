import { ForbiddenException } from '@nestjs/common';
import { FindManyOptions, Repository } from 'typeorm';
import { Grade } from 'src/entities/grades/grades.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { GradesService } from './grades.service';

function fixture() {
  const allGrades = Array.from({ length: 150 }, (_, idGrade) => ({ idGrade, score: 75 }));
  const grades = {
    find: jest
      .fn<Promise<typeof allGrades>, [FindManyOptions<Grade>]>()
      .mockResolvedValue(allGrades),
  };
  const students = {
    findOne: jest.fn().mockResolvedValue({ idEnrollment: 10, user: { idUser: 5 } }),
  };
  const access = { getManagedEnrollment: jest.fn().mockResolvedValue({ idEnrollment: 10 }) };
  const service = new GradesService(
    grades as unknown as Repository<Grade>,
    students as unknown as Repository<Enrollment>,
    {} as Repository<GradeSchemeDetail>,
    {} as Repository<Activity>,
    access as unknown as EnrollmentsService,
  );
  return { service, grades, access, allGrades };
}

describe('Individual grades read', () => {
  it('returns all individual grades while checking access without the unused course scheme', async () => {
    const f = fixture();
    expect(await f.service.getByEnrollment(2, 10)).toEqual(f.allGrades);
    expect(f.access.getManagedEnrollment).toHaveBeenCalledWith(2, 10, false);
    expect(f.grades.find.mock.calls[0][0].where).toContainEqual(
      expect.objectContaining({ enrollment: { idEnrollment: 10 } }),
    );
    expect(f.grades.find.mock.calls[0][0]).not.toHaveProperty('take');
  });
  it('does not read grades after a failed ownership check', async () => {
    const f = fixture();
    f.access.getManagedEnrollment.mockRejectedValue(new ForbiddenException());
    await expect(f.service.getByEnrollment(99, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.grades.find).not.toHaveBeenCalled();
  });
  it('preserves the student own-enrollment path', async () => {
    const f = fixture();
    expect(await f.service.getByEnrollment(5, 10)).toEqual(f.allGrades);
    expect(f.access.getManagedEnrollment).not.toHaveBeenCalled();
  });
});
