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

import { Repository } from 'typeorm';

import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSessionResponseDto } from 'src/dtos/attendances/attendance-session-response.dto';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
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
        attendances: true,
      },
      order: {
        date: 'DESC',
      },
    });

    return sessions.map((session) => ({
      idAttendanceSession: session.idAttendanceSession,
      date: session.date,
      presentCount: session.attendances.filter(
        (attendance) => attendance.status === AttendanceStatus.PRESENT,
      ).length,
      absentCount: session.attendances.filter(
        (attendance) => attendance.status === AttendanceStatus.ABSENT,
      ).length,
    }));
  }

  async getSession(idUser: number, idSession: number): Promise<AttendanceSession> {
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
        attendances: {
          enrollment: {
            user: true,
          },
        },
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

  async getSessionsPage(idUser: number, idEnrollment: number, query: AttendanceHistoryQueryDto) {
    await this.getAssistantEnrollment(idUser, idEnrollment);
    const { page = 1, limit = 10 } = query;
    const [sessions, total] = await this.attendanceSessionRepository.findAndCount({
      where: {
        assistantEnrollment: { idEnrollment },
        ...(query.date ? { date: query.date as unknown as Date } : {}),
      },
      relations: { attendances: true },
      order: { date: 'DESC', idAttendanceSession: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: sessions.map((session) => ({
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        presentCount: session.attendances.filter((item) => item.status === AttendanceStatus.PRESENT)
          .length,
        absentCount: session.attendances.filter((item) => item.status === AttendanceStatus.ABSENT)
          .length,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async saveAttendances(
    idUser: number,
    idSession: number,
    dto: AttendanceSaveDto,
  ): Promise<Attendance[]> {
    const session = await this.getSession(idUser, idSession);

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
      relations: {
        user: true,
      },
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
      const saved: Attendance[] = [];
      for (const record of dto.attendances) {
        const existing = await repository.findOne({
          where: {
            attendanceSession: { idAttendanceSession: idSession },
            enrollment: { idEnrollment: record.enrollmentId },
          },
        });
        const attendance =
          existing ??
          repository.create({
            attendanceSession: session,
            enrollment: { idEnrollment: record.enrollmentId },
          });
        attendance.status = record.status;
        saved.push(await repository.save(attendance));
      }
      return saved;
    });
  }

  async getStudentAttendance(
    idUser: number,
    idStudentEnrollment: number,
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

    const assistantEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: {
          idUser,
        },
        course: {
          idCourse: studentEnrollment.course.idCourse,
        },
        semester: {
          idSemester: studentEnrollment.semester.idSemester,
        },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      },
    });

    if (!assistantEnrollment) {
      throw new ForbiddenException(
        'No eres auxiliar de esta materia o la matrícula no está activa',
      );
    }

    const sessions = await this.attendanceSessionRepository.find({
      where: {
        assistantEnrollment: {
          idEnrollment: assistantEnrollment.idEnrollment,
        },
      },
      relations: {
        attendances: {
          enrollment: true,
        },
      },
      order: {
        date: 'ASC',
      },
    });

    const totalSessions = sessions.length;

    let presentSessions = 0;
    let absentSessions = 0;

    for (const session of sessions) {
      const attendance = session.attendances.find(
        (item) => item.enrollment.idEnrollment === studentEnrollment.idEnrollment,
      );

      if (!attendance) {
        continue;
      }

      if (attendance.status === AttendanceStatus.PRESENT) {
        presentSessions++;
      }

      if (attendance.status === AttendanceStatus.ABSENT) {
        absentSessions++;
      }
    }

    const percentage = totalSessions === 0 ? 0 : (presentSessions / totalSessions) * 100;

    return {
      totalSessions,
      presentSessions,
      absentSessions,
      percentage,
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
