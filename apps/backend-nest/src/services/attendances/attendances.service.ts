import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { buildStudentRosterQuery, getStudentRosterPage } from '@common/utils/student-roster';
import {
  attendanceSummary,
  attendancePermissionWeight,
  summarizeAttendanceStatuses,
} from '@common/utils/attendance-summary';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { AttendanceSessionUpdateDto } from 'src/dtos/attendances/attendance-session-update.dto';
import { AttendanceHistoryQueryDto } from 'src/dtos/attendances/attendance-history-query.dto';
import { CourseRelations } from '@common/enums/courseRelations';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSessionResponseDto } from 'src/dtos/attendances/attendance-session-response.dto';
import { StudentAttendanceResponseDto } from 'src/dtos/attendances/student-attendance-response.dto';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly attendanceSessionRepository: Repository<AttendanceSession>,

    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  private async getAssistantEnrollment(idUser: number, idEnrollment: number): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        user: {
          idUser,
        },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      },
      relations: {
        user: true,
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'No eres auxiliar de esta materia o la matrícula no está activa',
      );
    }

    return enrollment;
  }

  async createSession(idUser: number, dto: AttendanceSessionCreateDto): Promise<AttendanceSession> {
    const assistantEnrollment = await this.getAssistantEnrollment(idUser, dto.enrollmentId);

    const existingSession = await this.attendanceSessionRepository.findOne({
      where: {
        assistantEnrollment: {
          idEnrollment: assistantEnrollment.idEnrollment,
        },
        date: dto.date as unknown as Date,
      },
    });

    if (existingSession) {
      throw new ConflictException('Ya existe una sesión de asistencia para esta fecha');
    }

    const session = this.attendanceSessionRepository.create({
      assistantEnrollment,
      date: dto.date as unknown as Date,
    });

    return this.attendanceSessionRepository.save(session);
  }

  async getSessionsByEnrollment(
    idUser: number,
    idEnrollment: number,
  ): Promise<AttendanceSessionResponseDto[]> {
    const assistantEnrollment = await this.getAssistantEnrollment(idUser, idEnrollment);

    const sessions = await this.attendanceSessionRepository.find({
      where: {
        assistantEnrollment: {
          idEnrollment: assistantEnrollment.idEnrollment,
        },
      },
      relations: {
        attendances: { enrollment: true },
      },
      order: {
        date: 'DESC',
      },
    });

    return this.summarizeSessions(assistantEnrollment, sessions);
  }

  private async getPermissionWeight(assistantEnrollment: Enrollment): Promise<number> {
    const scheme = await this.enrollmentRepository.manager.getRepository(GradeScheme).findOne({
      where: {
        assistantEnrollment: { idEnrollment: assistantEnrollment.idEnrollment },
        isActive: true,
      },
      relations: { details: { gradeItem: true } },
    });
    return attendancePermissionWeight(scheme?.details);
  }

  private async summarizeSessions(
    assistantEnrollment: Enrollment,
    sessions: AttendanceSession[],
  ): Promise<AttendanceSessionResponseDto[]> {
    const students = await this.enrollmentRepository.find({
      where: {
        course: { idCourse: assistantEnrollment.course.idCourse },
        semester: { idSemester: assistantEnrollment.semester.idSemester },
        role: CourseRelations.STUDENT,
        isActive: true,
      },
    });
    const studentIds = new Set(students.map((student) => student.idEnrollment));
    const weight = await this.getPermissionWeight(assistantEnrollment);
    return sessions.map((session) => {
      const summary = summarizeAttendanceStatuses(
        session.attendances
          .filter((record) => studentIds.has(record.enrollment.idEnrollment))
          .map((record) => record.status),
        students.length,
        weight,
      );
      return {
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        presentCount: summary.present,
        excusedCount: summary.excused,
        absentCount: summary.absent,
        totalStudents: summary.total,
        percentage: summary.percentage,
      };
    });
  }

  async getSession(
    idUser: number,
    idSession: number,
    includeMarks = true,
  ): Promise<AttendanceSession> {
    const session = await this.attendanceSessionRepository.findOne({
      where: {
        idAttendanceSession: idSession,
      },
      relations: {
        assistantEnrollment: {
          user: true,
          course: true,
          semester: true,
        },
        ...(includeMarks ? { attendances: { enrollment: { user: true } } } : {}),
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión de asistencia no encontrada');
    }

    if (session.assistantEnrollment.user.idUser !== idUser) {
      throw new ForbiddenException('No tienes permisos para gestionar esta sesión');
    }

    if (
      !session.assistantEnrollment.isActive ||
      session.assistantEnrollment.role !== CourseRelations.ASSISTANT
    ) {
      throw new ForbiddenException('La matrícula del auxiliar no está activa');
    }

    return session;
  }

  async getSessionPage(idUser: number, idSession: number, query: StudentRosterQueryDto) {
    const session = await this.getSession(idUser, idSession, false);
    const assistant = session.assistantEnrollment;
    const roster = await getStudentRosterPage(this.enrollmentRepository, assistant, query);
    const ids = roster.data.map((student) => student.idEnrollment);
    const [marks, total, counts, weight] = await Promise.all([
      ids.length
        ? this.attendanceRepository.find({
            where: {
              attendanceSession: { idAttendanceSession: idSession },
              enrollment: { idEnrollment: In(ids) },
            },
            relations: { enrollment: true },
          })
        : Promise.resolve([]),
      buildStudentRosterQuery(this.enrollmentRepository, assistant).getCount(),
      this.attendanceRepository
        .createQueryBuilder('attendance')
        .select('attendance.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .innerJoin('attendance.enrollment', 'student')
        .where('attendance.id_attendance_session = :idSession', { idSession })
        .andWhere('student.id_course = :courseId', { courseId: assistant.course.idCourse })
        .andWhere('student.id_semester = :semesterId', {
          semesterId: assistant.semester.idSemester,
        })
        .andWhere('student.role = :role', { role: CourseRelations.STUDENT })
        .andWhere('student.isActive = true')
        .groupBy('attendance.status')
        .getRawMany<{ status: AttendanceStatus; count: string }>(),
      this.getPermissionWeight(assistant),
    ]);
    const count = (status: AttendanceStatus) =>
      Number(counts.find((row) => row.status === status)?.count ?? 0);
    const summary = attendanceSummary(
      count(AttendanceStatus.PRESENT),
      count(AttendanceStatus.EXCUSED),
      total,
      weight,
    );
    return {
      data: {
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        students: roster.data,
        attendances: marks.map((mark) => ({
          ...mark,
          observation: mark.status === AttendanceStatus.EXCUSED ? mark.observation : null,
        })),
        presentCount: summary.present,
        excusedCount: summary.excused,
        absentCount: summary.absent,
        totalStudents: total,
        percentage: summary.percentage,
      },
      meta: roster.meta,
    };
  }

  async getSessionsPage(idUser: number, idEnrollment: number, query: AttendanceHistoryQueryDto) {
    const assistantEnrollment = await this.getAssistantEnrollment(idUser, idEnrollment);
    const { page = 1, limit = 10 } = query;
    const [sessions, total] = await this.attendanceSessionRepository.findAndCount({
      where: {
        assistantEnrollment: { idEnrollment },
        ...(query.date ? { date: query.date as unknown as Date } : {}),
      },
      relations: { attendances: { enrollment: true } },
      order: { date: 'DESC', idAttendanceSession: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: await this.summarizeSessions(assistantEnrollment, sessions),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async saveAttendances(
    idUser: number,
    idSession: number,
    dto: AttendanceSaveDto,
  ): Promise<Attendance[]> {
    const session = await this.getSession(idUser, idSession, false);

    const studentEnrollments = await this.enrollmentRepository.find({
      where: {
        course: {
          idCourse: session.assistantEnrollment.course.idCourse,
        },
        semester: {
          idSemester: session.assistantEnrollment.semester.idSemester,
        },
        role: CourseRelations.STUDENT,
        isActive: true,
      },
      select: { idEnrollment: true },
    });

    const validStudentIds = new Set(
      studentEnrollments.map((enrollment) => enrollment.idEnrollment),
    );

    const submittedIds = new Set<number>();

    for (const attendance of dto.attendances) {
      if (submittedIds.has(attendance.enrollmentId)) {
        throw new BadRequestException(
          `El estudiante ${attendance.enrollmentId} fue enviado más de una vez`,
        );
      }

      submittedIds.add(attendance.enrollmentId);

      if (!validStudentIds.has(attendance.enrollmentId)) {
        throw new BadRequestException(
          `El estudiante ${attendance.enrollmentId} no pertenece a esta materia`,
        );
      }
    }

    return this.attendanceRepository.manager.transaction(async (manager) => {
      // Serialize writes to a session, including insertion of previously unmarked students.
      await manager.getRepository(AttendanceSession).findOneOrFail({
        where: { idAttendanceSession: idSession },
        lock: { mode: 'pessimistic_write' },
      });
      const repository = manager.getRepository(Attendance);
      const ids = dto.markAll ? [...validStudentIds] : [...submittedIds];
      if (!ids.length) return [];
      const existing = await repository.find({
        where: {
          attendanceSession: { idAttendanceSession: idSession },
          enrollment: { idEnrollment: In(ids) },
        },
        relations: { enrollment: true },
      });
      const previous = new Map(existing.map((record) => [record.enrollment.idEnrollment, record]));
      const overrides = new Map(dto.attendances.map((record) => [record.enrollmentId, record]));
      const values = ids
        .map((id) => {
          const override = overrides.get(id);
          const status = override?.status ?? dto.markAll!;
          const oldObservation = dto.markAll ? null : previous.get(id)?.observation;
          return {
            attendanceSession: { idAttendanceSession: idSession },
            enrollment: { idEnrollment: id },
            status,
            observation:
              status === AttendanceStatus.EXCUSED
                ? (override?.observation === undefined
                    ? oldObservation
                    : override.observation
                  )?.trim() || null
                : null,
          };
        })
        .filter(
          (record) =>
            record.status !== AttendanceStatus.ABSENT ||
            previous.has(record.enrollment.idEnrollment),
        );
      // Keep missing absences implicit; only existing marks need to be updated to ABSENT.
      // Chunk writes to stay below PostgreSQL's parameter limit, with one session lock for the entire bulk.
      for (let offset = 0; offset < values.length; offset += 1000)
        await repository.upsert(values.slice(offset, offset + 1000), [
          'attendanceSession',
          'enrollment',
        ]);
      // A global intent can affect thousands of rows; return only explicit overrides to the paginated client.
      const confirmedIds = dto.markAll ? [...submittedIds] : ids;
      return confirmedIds.length
        ? repository.find({
            where: {
              attendanceSession: { idAttendanceSession: idSession },
              enrollment: { idEnrollment: In(confirmedIds) },
            },
            relations: { enrollment: true },
          })
        : [];
    });
  }

  async getStudentAttendance(
    idUser: number,
    idStudentEnrollment: number,
  ): Promise<StudentAttendanceResponseDto> {
    return this.summarizeStudentAttendance(idUser, idStudentEnrollment, false);
  }

  async getMyStudentAttendance(
    idUser: number,
    idStudentEnrollment: number,
  ): Promise<StudentAttendanceResponseDto> {
    return this.summarizeStudentAttendance(idUser, idStudentEnrollment, true);
  }

  private async summarizeStudentAttendance(
    idUser: number,
    idStudentEnrollment: number,
    ownOnly: boolean,
  ): Promise<StudentAttendanceResponseDto> {
    const studentEnrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: idStudentEnrollment,
        role: CourseRelations.STUDENT,
        isActive: true,
      },
      relations: {
        user: true,
        course: true,
        semester: true,
      },
    });

    if (!studentEnrollment) {
      throw new NotFoundException('Matrícula del estudiante no encontrada');
    }

    if (ownOnly && studentEnrollment.user.idUser !== idUser) {
      throw new ForbiddenException('Solo puedes consultar tu propia asistencia');
    }

    const assistantWhere = {
      ...(!ownOnly ? { user: { idUser } } : {}),
      course: {
        idCourse: studentEnrollment.course.idCourse,
      },
      semester: {
        idSemester: studentEnrollment.semester.idSemester,
      },
      role: CourseRelations.ASSISTANT,
      isActive: true,
    };
    const candidates = ownOnly
      ? await this.enrollmentRepository.find({ where: assistantWhere })
      : [await this.enrollmentRepository.findOne({ where: assistantWhere })];

    if (ownOnly && candidates.length > 1) {
      throw new BadRequestException('No se puede determinar un único auxiliar para tu asistencia');
    }
    const assistantEnrollment = candidates[0];

    if (!assistantEnrollment) {
      if (ownOnly)
        return {
          totalSessions: 0,
          presentSessions: 0,
          excusedSessions: 0,
          absentSessions: 0,
          percentage: 0,
        };
      throw new ForbiddenException(
        'No eres auxiliar de esta materia o la matrícula no está activa',
      );
    }

    const [totalSessions, counts, permissionWeight] = await Promise.all([
      this.attendanceSessionRepository.countBy({
        assistantEnrollment: { idEnrollment: assistantEnrollment.idEnrollment },
      }),
      this.attendanceRepository
        .createQueryBuilder('attendance')
        .select('COUNT(*) FILTER (WHERE attendance.status = :present)', 'present')
        .addSelect('COUNT(*) FILTER (WHERE attendance.status = :excused)', 'excused')
        .innerJoin('attendance.attendanceSession', 'session')
        .where('session.id_assistant_enrollment = :assistantId', {
          assistantId: assistantEnrollment.idEnrollment,
        })
        .andWhere('attendance.id_enrollment = :studentId', {
          studentId: studentEnrollment.idEnrollment,
        })
        .setParameters({ present: AttendanceStatus.PRESENT, excused: AttendanceStatus.EXCUSED })
        .getRawOne<{ present: string; excused: string }>(),
      this.getPermissionWeight(assistantEnrollment),
    ]);
    const summary = attendanceSummary(
      Number(counts?.present ?? 0),
      Number(counts?.excused ?? 0),
      totalSessions,
      permissionWeight,
    );
    return {
      totalSessions: summary.total,
      presentSessions: summary.present,
      excusedSessions: summary.excused,
      absentSessions: summary.absent,
      percentage: summary.percentage,
    };
  }

  async updateSession(idUser: number, idSession: number, dto: AttendanceSessionUpdateDto) {
    const session = await this.getSession(idUser, idSession);
    const duplicate = await this.attendanceSessionRepository.findOne({
      where: {
        assistantEnrollment: { idEnrollment: session.assistantEnrollment.idEnrollment },
        date: dto.date as unknown as Date,
      },
    });
    if (duplicate && duplicate.idAttendanceSession !== idSession)
      throw new ConflictException('Ya existe una sesión de asistencia para esta fecha');
    session.date = dto.date as unknown as Date;
    return this.attendanceSessionRepository.save(session);
  }

  async deleteSession(idUser: number, idSession: number) {
    await this.getSession(idUser, idSession);
    await this.attendanceSessionRepository.manager.transaction(async (manager) => {
      await manager
        .getRepository(Attendance)
        .delete({ attendanceSession: { idAttendanceSession: idSession } });
      await manager.getRepository(AttendanceSession).delete({ idAttendanceSession: idSession });
    });
    return { message: 'Sesión de asistencia eliminada' };
  }

  async deleteAttendance(idUser: number, idSession: number, idEnrollment: number) {
    await this.getSession(idUser, idSession);
    const result = await this.attendanceRepository.delete({
      attendanceSession: { idAttendanceSession: idSession },
      enrollment: { idEnrollment },
    });
    if (!result.affected) throw new NotFoundException('Asistencia no encontrada');
    return { message: 'Asistencia eliminada' };
  }
}
