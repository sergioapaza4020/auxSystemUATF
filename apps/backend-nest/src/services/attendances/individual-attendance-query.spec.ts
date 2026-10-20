import { CourseRelations } from '@common/enums/courseRelations';
import { DataSource, Repository } from 'typeorm';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendancesService } from './attendances.service';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('Individual attendance PostgreSQL query', () => {
  it('aggregates only one student in the selected assistant context without hydrating marks', async () => {
    const source = new MetadataSource({
      type: 'postgres',
      entities: [__dirname + '/../../entities/**/*.entity.ts'],
    });
    await source.prepare();
    const marks = source.getRepository(Attendance);
    const query = marks.createQueryBuilder('attendance');
    jest.spyOn(marks, 'createQueryBuilder').mockReturnValue(query);
    jest.spyOn(query, 'getRawOne').mockResolvedValue({ present: '3', excused: '1' });
    const sessions = { countBy: jest.fn().mockResolvedValue(10) };
    const enrollments = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          idEnrollment: 1,
          user: { idUser: 5 },
          course: { idCourse: 3 },
          semester: { idSemester: 4 },
        })
        .mockResolvedValueOnce({ idEnrollment: 20 }),
      manager: { getRepository: () => ({ findOne: () => Promise.resolve(null) }) },
    };
    const service = new AttendancesService(
      sessions as unknown as Repository<AttendanceSession>,
      marks,
      enrollments as unknown as Repository<Enrollment>,
    );
    expect(await service.getStudentAttendance(2, 1)).toMatchObject({
      totalSessions: 10,
      presentSessions: 3,
      excusedSessions: 1,
      absentSessions: 6,
      percentage: 40,
    });
    const sql = query.getSql();
    expect(sql).toContain('COUNT(*) FILTER');
    expect(sql).toContain('"session"."id_assistant_enrollment" =');
    expect(sql).toContain('"attendance"."id_enrollment" =');
    expect(sql).not.toContain('"observation"');
    expect(sql).not.toContain('"enrollments"');
    expect(query.getParameters()).toMatchObject({
      assistantId: 20,
      studentId: 1,
      present: AttendanceStatus.PRESENT,
      excused: AttendanceStatus.EXCUSED,
    });
    expect(sessions.countBy).toHaveBeenCalledWith({ assistantEnrollment: { idEnrollment: 20 } });
    expect(enrollments.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        course: { idCourse: 3 },
        semester: { idSemester: 4 },
        user: { idUser: 2 },
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
    });
  });
});
