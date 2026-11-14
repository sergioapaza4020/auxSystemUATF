import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';
import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { buildStudentRosterQuery, getStudentRosterPage } from '@common/utils/student-roster';
import {
  attendanceSummary,
  attendancePermissionWeight,
  summarizeAttendanceStatuses,
} from '@common/utils/attendance-summary';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendanceSessionMode } from '@common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';
import {
  attendanceAcademicDate,
  attendanceDateValue,
  getAttendanceSessionState,
  isAttendanceSessionComputable,
  isSelfRegistrationMode,
} from '@common/utils/attendance-session-policy';
import { AttendanceGeolocationConfigDto } from 'src/dtos/attendances/attendance-geolocation-config.dto';
import { attendanceSessionResponse } from 'src/dtos/attendances/attendance-session-lifecycle-response.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceCheckInCode as CheckInCode } from '@common/enums/attendanceCheckInCode';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { calculateDistanceMeters } from '@common/utils/geolocation-distance';
import { AttendanceCheckInDto } from 'src/dtos/attendances/attendance-check-in.dto';
import { AttendanceCheckInResponseDto } from 'src/dtos/attendances/attendance-check-in-response.dto';
import { StudentAttendanceSessionDto } from 'src/dtos/attendances/student-attendance-session.dto';
import {
  AttendanceQrConfigDto,
  AttendanceQrTokenDto,
} from 'src/dtos/attendances/attendance-qr.dto';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { User } from 'src/entities/users/users.entity';
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
  HttpStatus,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { EntityManager, In, Repository, QueryFailedError } from 'typeorm';

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
    private readonly qrTokens: AttendanceQrTokenService = new AttendanceQrTokenService(),
  ) {}

  private requireQrOpen(session: AttendanceSession, now: Date) {
    if (session.mode !== AttendanceSessionMode.QR)
      throw new AttendanceCheckInException(CheckInCode.QR_NOT_AVAILABLE, HttpStatus.CONFLICT);
    const state = this.checkInState(session, now);
    if (state !== State.OPEN)
      throw new AttendanceCheckInException(
        state === State.CANCELLED
          ? CheckInCode.SESSION_CANCELLED
          : state === State.CLOSED
            ? CheckInCode.SESSION_CLOSED
            : CheckInCode.SESSION_NOT_STARTED,
        HttpStatus.CONFLICT,
      );
  }

  async getQr(idUser: number, idSession: number) {
    return this.withLockedSession(idUser, idSession, (session, _manager, now) => {
      this.requireQrOpen(session, now);
      this.validateQrAcademicContext(session);
      return Promise.resolve(this.qrTokens.issue(session, now));
    });
  }

  private validateQrAcademicContext(session: AttendanceSession) {
    const owner = session.assistantEnrollment;
    if (
      !owner?.isActive ||
      owner.role !== CourseRelations.ASSISTANT ||
      !owner.user?.isActive ||
      !owner.course?.isActive ||
      !owner.semester?.isActive
    )
      throw new AttendanceCheckInException(
        CheckInCode.SESSION_CONTEXT_INVALID,
        HttpStatus.CONFLICT,
      );
    if (session.startsAt && session.endsAt) {
      const { startDate, endDate } = owner.semester;
      if (
        !(startDate instanceof Date) ||
        !(endDate instanceof Date) ||
        !Number.isFinite(startDate.getTime()) ||
        !Number.isFinite(endDate.getTime()) ||
        session.startsAt < startDate ||
        session.endsAt > endDate
      )
        throw new AttendanceCheckInException(
          CheckInCode.SESSION_CONTEXT_INVALID,
          HttpStatus.CONFLICT,
        );
    }
  }

  async configureQr(idUser: number, idSession: number, dto: AttendanceQrConfigDto) {
    if (
      validateSync(plainToInstance(AttendanceQrConfigDto, dto), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length
    )
      throw new BadRequestException('QR_CONFIGURATION_INVALID');
    return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
      if (session.mode !== AttendanceSessionMode.QR)
        throw new AttendanceCheckInException(CheckInCode.QR_NOT_AVAILABLE, HttpStatus.CONFLICT);
      this.requireSelfRegistrationDraft(session, now);
      if (
        await manager
          .getRepository(Attendance)
          .countBy({ attendanceSession: { idAttendanceSession: idSession } })
      )
        throw new ConflictException('SESSION_HAS_ATTENDANCE');
      session.startsAt = new Date(dto.startsAt);
      session.endsAt = new Date(dto.endsAt);
      // ISO validation also accepts week/ordinal dates that JavaScript cannot parse.
      if (
        !Number.isFinite(session.startsAt.getTime()) ||
        !Number.isFinite(session.endsAt.getTime())
      )
        throw new BadRequestException('QR_CONFIGURATION_INVALID');
      session.date = attendanceAcademicDate(session.startsAt) as unknown as Date;
      this.validateActivation(session, now);
      await this.ensureDateAvailable(session, manager);
      await manager.getRepository(AttendanceSession).save(session);
      return attendanceSessionResponse(session, now);
    });
  }

  private async qrStudentContext(manager: EntityManager, idUser: number, idSession: number) {
    const session = await manager.getRepository(AttendanceSession).findOne({
      where: { idAttendanceSession: idSession },
      relations: { assistantEnrollment: { user: true, course: true, semester: true } },
    });
    if (!session)
      throw new AttendanceCheckInException(CheckInCode.NOT_ENROLLED, HttpStatus.FORBIDDEN);
    const assistant = session.assistantEnrollment;
    // Return no state, course or owner information before academic authorization.
    const user = await manager.getRepository(User).findOne({ where: { idUser, isActive: true } });
    const enrollment =
      user && assistant?.course && assistant?.semester
        ? await manager.getRepository(Enrollment).findOne({
            where: {
              user: { idUser },
              course: { idCourse: assistant.course.idCourse },
              semester: { idSemester: assistant.semester.idSemester },
              role: CourseRelations.STUDENT,
              isActive: true,
            },
            lock: { mode: 'pessimistic_read' },
          })
        : null;
    if (!enrollment)
      throw new AttendanceCheckInException(CheckInCode.NOT_ENROLLED, HttpStatus.FORBIDDEN);
    if (
      !assistant.isActive ||
      assistant.role !== CourseRelations.ASSISTANT ||
      !assistant.user?.isActive
    )
      throw new AttendanceCheckInException(
        CheckInCode.SESSION_CONTEXT_INVALID,
        HttpStatus.CONFLICT,
      );
    if (session.mode !== AttendanceSessionMode.QR)
      throw new AttendanceCheckInException(CheckInCode.QR_NOT_AVAILABLE, HttpStatus.CONFLICT);
    this.validateQrAcademicContext(session);
    const own = await manager.getRepository(Attendance).findOne({
      where: {
        attendanceSession: { idAttendanceSession: idSession },
        enrollment: { idEnrollment: enrollment.idEnrollment },
      },
    });
    return { session, enrollment, own };
  }

  private ownQrMark(mark: Attendance | null) {
    return mark
      ? {
          status: mark.status,
          registrationMethod: mark.registrationMethod,
          markedAt: mark.markedAt,
        }
      : null;
  }

  async getQrOwnMark(idUser: number, idSession: number) {
    return this.attendanceSessionRepository.manager.transaction(async (manager) => {
      const { own } = await this.qrStudentContext(manager, idUser, idSession);
      return { ownMark: this.ownQrMark(own) };
    });
  }

  private async qrAttempt(
    idUser: number,
    idSession: number,
    dto: AttendanceQrTokenDto,
    insert: boolean,
  ) {
    if (
      validateSync(plainToInstance(AttendanceQrTokenDto, dto), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length
    )
      throw new AttendanceCheckInException(CheckInCode.QR_TOKEN_INVALID, HttpStatus.BAD_REQUEST);
    const token = this.qrTokens.verify(dto.token, idSession);
    try {
      return await this.attendanceSessionRepository.manager.transaction(async (manager) => {
        const locked = await manager.getRepository(AttendanceSession).findOne({
          where: { idAttendanceSession: idSession },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked)
          throw new AttendanceCheckInException(CheckInCode.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
        const { session, enrollment, own } = await this.qrStudentContext(
          manager,
          idUser,
          idSession,
        );
        this.requireQrOpen(session, new Date());
        if (insert && own)
          throw new AttendanceCheckInException(CheckInCode.ALREADY_REGISTERED, HttpStatus.CONFLICT);
        const now = new Date();
        this.requireQrOpen(session, now);
        const expiresAt = this.qrTokens.validatePeriod(token, session, now);
        if (!insert)
          return {
            idAttendanceSession: idSession,
            course: {
              name: session.assistantEnrollment.course.name,
              group: session.assistantEnrollment.course.group,
            },
            date: session.date,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            expiresAt,
            state: State.OPEN,
            ownMark: this.ownQrMark(own),
          };
        const repository = manager.getRepository(Attendance);
        const saved = await repository.save(
          repository.create({
            attendanceSession: { idAttendanceSession: idSession },
            enrollment: { idEnrollment: enrollment.idEnrollment },
            status: AttendanceStatus.PRESENT,
            registrationMethod: AttendanceRegistrationMethod.QR,
            markedAt: now,
            markedBy: { idUser },
            accuracy: null,
            distanceMeters: null,
          }),
        );
        return {
          code: CheckInCode.SUCCESS,
          idAttendance: saved.idAttendance,
          status: AttendanceStatus.PRESENT,
          registrationMethod: AttendanceRegistrationMethod.QR,
          markedAt: now,
        };
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driver: unknown = error.driverError;
        if (
          driver &&
          typeof driver === 'object' &&
          'code' in driver &&
          driver.code === '23505' &&
          'constraint' in driver &&
          driver.constraint === 'UQ_7880aee9d2b1416261167c83e86'
        )
          throw new AttendanceCheckInException(CheckInCode.ALREADY_REGISTERED, HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  checkInQr(idUser: number, idSession: number, dto: AttendanceQrTokenDto) {
    return this.qrAttempt(idUser, idSession, dto, true);
  }

  getQrContext(idUser: number, idSession: number, dto: AttendanceQrTokenDto) {
    return this.qrAttempt(idUser, idSession, dto, false);
  }

  private checkInState(session: AttendanceSession, now: Date): State | null {
    try {
      return getAttendanceSessionState(session, now);
    } catch {
      throw new AttendanceCheckInException(
        CheckInCode.SESSION_CONTEXT_INVALID,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkIn(
    idUser: number,
    idSession: number,
    dto: AttendanceCheckInDto,
  ): Promise<AttendanceCheckInResponseDto> {
    if (
      validateSync(plainToInstance(AttendanceCheckInDto, dto), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length
    )
      throw new AttendanceCheckInException(CheckInCode.LOCATION_INVALID, HttpStatus.BAD_REQUEST);
    try {
      return await this.attendanceSessionRepository.manager.transaction(async (manager) => {
        const sessions = manager.getRepository(AttendanceSession);
        // Same row and lock as lifecycle operations and manual save. Do not use
        // the auxiliary-only ownership loader for a student's explicit session.
        const locked = await sessions.findOne({
          where: { idAttendanceSession: idSession },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked)
          throw new AttendanceCheckInException(CheckInCode.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
        const session = await sessions.findOne({
          where: { idAttendanceSession: idSession },
          relations: { assistantEnrollment: { user: true, course: true, semester: true } },
        });
        const now = new Date();
        if (!session)
          throw new AttendanceCheckInException(CheckInCode.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
        if (session.mode !== AttendanceSessionMode.GEOLOCATION)
          throw new AttendanceCheckInException(
            CheckInCode.SESSION_NOT_GEOLOCATION,
            HttpStatus.CONFLICT,
          );
        const assistant = session.assistantEnrollment;
        if (
          !assistant?.isActive ||
          assistant.role !== CourseRelations.ASSISTANT ||
          !assistant.user ||
          !assistant.course ||
          !assistant.semester
        )
          throw new AttendanceCheckInException(
            CheckInCode.SESSION_CONTEXT_INVALID,
            HttpStatus.CONFLICT,
          );
        const state = this.checkInState(session, now);
        if (state !== State.OPEN) {
          const code =
            state === State.CANCELLED
              ? CheckInCode.SESSION_CANCELLED
              : state === State.CLOSED
                ? CheckInCode.SESSION_CLOSED
                : CheckInCode.SESSION_NOT_STARTED;
          throw new AttendanceCheckInException(code, HttpStatus.CONFLICT);
        }
        const enrollment = await manager.getRepository(Enrollment).findOne({
          where: {
            user: { idUser },
            course: { idCourse: assistant.course.idCourse },
            semester: { idSemester: assistant.semester.idSemester },
            role: CourseRelations.STUDENT,
            isActive: true,
          },
        });
        if (!enrollment)
          throw new AttendanceCheckInException(CheckInCode.NOT_ENROLLED, HttpStatus.FORBIDDEN);
        const repository = manager.getRepository(Attendance);
        if (
          await repository.findOne({
            where: {
              attendanceSession: { idAttendanceSession: idSession },
              enrollment: { idEnrollment: enrollment.idEnrollment },
            },
          })
        )
          throw new AttendanceCheckInException(CheckInCode.ALREADY_REGISTERED, HttpStatus.CONFLICT);
        const latitude = Number(session.latitude);
        const longitude = Number(session.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
          throw new AttendanceCheckInException(
            CheckInCode.SESSION_CONTEXT_INVALID,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        if (dto.accuracy > session.maximumAcceptedAccuracy!)
          throw new AttendanceCheckInException(
            CheckInCode.LOW_ACCURACY,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        const distance = calculateDistanceMeters(latitude, longitude, dto.latitude, dto.longitude);
        if (distance > session.radiusMeters!)
          throw new AttendanceCheckInException(
            CheckInCode.OUTSIDE_AREA,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        const accuracy = dto.accuracy.toFixed(2);
        // numeric(10,2) cannot represent a larger accepted measurement.
        if (Number(accuracy) > 99_999_999.99)
          throw new AttendanceCheckInException(
            CheckInCode.LOCATION_INVALID,
            HttpStatus.BAD_REQUEST,
          );
        const record = repository.create({
          attendanceSession: { idAttendanceSession: idSession },
          enrollment: { idEnrollment: enrollment.idEnrollment },
          status: AttendanceStatus.PRESENT,
          registrationMethod: AttendanceRegistrationMethod.GEOLOCATION,
          markedAt: now,
          markedBy: { idUser },
          accuracy,
          distanceMeters: distance.toFixed(2),
        });
        const saved = await repository.save(record);
        // Explicit allowlist: no position, geofence, relationships or other students.
        return {
          code: CheckInCode.SUCCESS,
          idAttendance: saved.idAttendance,
          status: AttendanceStatus.PRESENT,
          registrationMethod: AttendanceRegistrationMethod.GEOLOCATION,
          markedAt: now,
        };
      });
    } catch (error) {
      const driver: unknown = error instanceof QueryFailedError ? error.driverError : null;
      if (
        driver &&
        typeof driver === 'object' &&
        'code' in driver &&
        driver.code === '23505' &&
        'constraint' in driver &&
        driver.constraint === 'UQ_7880aee9d2b1416261167c83e86'
      )
        throw new AttendanceCheckInException(CheckInCode.ALREADY_REGISTERED, HttpStatus.CONFLICT);
      throw error;
    }
  }

  async getOwnEligibleSessions(idUser: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { idEnrollment, user: { idUser }, role: CourseRelations.STUDENT, isActive: true },
      relations: { course: true, semester: true },
    });
    if (!enrollment?.course || !enrollment.semester)
      throw new AttendanceCheckInException(CheckInCode.NOT_ENROLLED, HttpStatus.FORBIDDEN);
    const now = new Date();
    const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const limit = 20;
    const sessions = await this.attendanceSessionRepository
      .createQueryBuilder('session')
      .innerJoin('session.assistantEnrollment', 'assistant')
      .where('assistant.id_course = :courseId', { courseId: enrollment.course.idCourse })
      .andWhere('assistant.id_semester = :semesterId', {
        semesterId: enrollment.semester.idSemester,
      })
      .andWhere('assistant.isActive = true')
      .andWhere('assistant.role = :assistantRole', { assistantRole: CourseRelations.ASSISTANT })
      .andWhere('session.mode = :mode', { mode: AttendanceSessionMode.GEOLOCATION })
      .andWhere('session.openedAt IS NOT NULL')
      .andWhere('session.closedAt IS NULL AND session.cancelledAt IS NULL')
      .andWhere('session.endsAt > :now AND session.startsAt <= :upcomingUntil', {
        now,
        upcomingUntil,
      })
      .orderBy('CASE WHEN session.startsAt <= :now THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('session.startsAt', 'ASC')
      .addOrderBy('session.idAttendanceSession', 'ASC')
      .limit(limit + 1)
      .getMany();
    const visible = sessions.slice(0, limit);
    const marks = visible.length
      ? await this.attendanceRepository.find({
          where: {
            attendanceSession: {
              idAttendanceSession: In(visible.map((session) => session.idAttendanceSession)),
            },
            enrollment: { idEnrollment },
          },
          relations: { attendanceSession: true },
          select: {
            idAttendance: true,
            status: true,
            markedAt: true,
            attendanceSession: { idAttendanceSession: true },
          },
        })
      : [];
    const own = new Map(marks.map((mark) => [mark.attendanceSession.idAttendanceSession, mark]));
    const data: StudentAttendanceSessionDto[] = visible.map((session) => {
      const state = this.checkInState(session, now);
      if (state !== State.OPEN && state !== State.SCHEDULED)
        throw new AttendanceCheckInException(
          CheckInCode.SESSION_CONTEXT_INVALID,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      const mark = own.get(session.idAttendanceSession);
      return {
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        startsAt: session.startsAt!,
        endsAt: session.endsAt!,
        state,
        isComputable: isAttendanceSessionComputable(session, now),
        alreadyRegistered: !!mark,
        ownStatus: mark?.status ?? null,
        ownMarkedAt: mark?.markedAt ?? null,
      };
    });
    return { data, meta: { limit, hasMore: sessions.length > limit, upcomingUntil } };
  }

  private async getAssistantEnrollment(
    idUser: number,
    idEnrollment: number,
    manager?: EntityManager,
  ): Promise<Enrollment> {
    const enrollment = await (
      manager?.getRepository(Enrollment) ?? this.enrollmentRepository
    ).findOne({
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
    if (dto.mode === AttendanceSessionMode.QR) {
      return this.attendanceSessionRepository.manager.transaction(async (manager) => {
        await manager.getRepository(Enrollment).findOne({
          where: { idEnrollment: dto.enrollmentId },
          lock: { mode: 'pessimistic_write' },
        });
        return this.createSessionRecord(idUser, dto, manager);
      });
    }
    return this.createSessionRecord(idUser, dto);
  }

  private async createSessionRecord(
    idUser: number,
    dto: AttendanceSessionCreateDto,
    manager?: EntityManager,
  ): Promise<AttendanceSession> {
    if (
      dto.mode !== undefined &&
      dto.mode !== AttendanceSessionMode.MANUAL &&
      dto.mode !== AttendanceSessionMode.GEOLOCATION &&
      dto.mode !== AttendanceSessionMode.QR
    )
      throw new BadRequestException('SESSION_MODE_INVALID');
    const assistantEnrollment = await this.getAssistantEnrollment(
      idUser,
      dto.enrollmentId,
      manager,
    );
    const repository =
      manager?.getRepository(AttendanceSession) ?? this.attendanceSessionRepository;

    const existingSession = await repository.findOne({
      where: {
        assistantEnrollment: {
          idEnrollment: assistantEnrollment.idEnrollment,
        },
        date: dto.date as unknown as Date,
      },
    });

    if (existingSession) {
      throw new ConflictException(
        dto.mode !== undefined && isSelfRegistrationMode(dto.mode)
          ? 'SESSION_DATE_CONFLICT'
          : 'Ya existe una sesión de asistencia para esta fecha',
      );
    }

    const session = repository.create({
      assistantEnrollment,
      date: dto.date as unknown as Date,
      ...(dto.mode !== undefined && isSelfRegistrationMode(dto.mode)
        ? {
            mode: dto.mode,
            openedAt: null,
            closedAt: null,
            cancelledAt: null,
          }
        : {}),
    });

    try {
      return await repository.save(session);
    } catch (error) {
      this.rethrowDateConflict(error);
    }
  }

  private rethrowDateConflict(error: unknown): never {
    const driver: unknown = error instanceof QueryFailedError ? error.driverError : null;
    if (
      driver &&
      typeof driver === 'object' &&
      'code' in driver &&
      driver.code === '23505' &&
      'constraint' in driver &&
      driver.constraint === 'UQ_8cd3866ee6beebfc50a0bab1962'
    )
      throw new ConflictException('SESSION_DATE_CONFLICT');
    throw error;
  }

  private async withLockedSession<T>(
    idUser: number,
    idSession: number,
    work: (session: AttendanceSession, manager: EntityManager, now: Date) => Promise<T>,
  ): Promise<T> {
    await this.getSession(idUser, idSession, false, true);
    try {
      return await this.attendanceSessionRepository.manager.transaction(async (manager) => {
        const locked = await manager.getRepository(AttendanceSession).findOne({
          where: { idAttendanceSession: idSession },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Sesión de asistencia no encontrada');
        const session = await this.getSession(idUser, idSession, false, true, manager);
        const now = new Date();
        return work(session, manager, now);
      });
    } catch (error) {
      this.rethrowDateConflict(error);
    }
  }

  private requireSelfRegistrationDraft(session: AttendanceSession, now: Date) {
    if (!isSelfRegistrationMode(session.mode))
      throw new BadRequestException('SESSION_NOT_GEOLOCATION');
    const state = getAttendanceSessionState(session, now);
    if (state === State.CANCELLED) throw new ConflictException('SESSION_CANCELLED');
    if (state !== State.DRAFT) throw new ConflictException('SESSION_ALREADY_ACTIVATED');
  }

  private async ensureDateAvailable(session: AttendanceSession, manager: EntityManager) {
    const duplicate = await manager.getRepository(AttendanceSession).findOne({
      where: {
        assistantEnrollment: { idEnrollment: session.assistantEnrollment.idEnrollment },
        date: session.date,
      },
    });
    if (duplicate && duplicate.idAttendanceSession !== session.idAttendanceSession)
      throw new ConflictException('SESSION_DATE_CONFLICT');
  }

  async configureGeolocation(
    idUser: number,
    idSession: number,
    dto: AttendanceGeolocationConfigDto,
  ) {
    if (validateSync(plainToInstance(AttendanceGeolocationConfigDto, dto)).length)
      throw new BadRequestException('GEO_CONFIGURATION_INVALID');
    return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
      if (session.mode !== AttendanceSessionMode.GEOLOCATION)
        throw new BadRequestException('SESSION_NOT_GEOLOCATION');
      this.requireSelfRegistrationDraft(session, now);
      if (
        await manager.getRepository(Attendance).countBy({
          attendanceSession: { idAttendanceSession: idSession },
        })
      )
        throw new ConflictException('SESSION_HAS_ATTENDANCE');
      if (dto.latitude !== undefined) session.latitude = String(dto.latitude);
      if (dto.longitude !== undefined) session.longitude = String(dto.longitude);
      if (dto.radiusMeters !== undefined) session.radiusMeters = dto.radiusMeters;
      if (dto.maximumAcceptedAccuracy !== undefined)
        session.maximumAcceptedAccuracy = dto.maximumAcceptedAccuracy;
      if (dto.startsAt !== undefined) {
        session.startsAt = new Date(dto.startsAt);
        session.date = attendanceAcademicDate(session.startsAt) as unknown as Date;
      }
      if (dto.endsAt !== undefined) session.endsAt = new Date(dto.endsAt);
      if (session.startsAt && session.endsAt && session.startsAt >= session.endsAt)
        throw new BadRequestException('INVALID_TIME_WINDOW');
      await this.ensureDateAvailable(session, manager);
      await manager.getRepository(AttendanceSession).save(session);
      return attendanceSessionResponse(session, now);
    });
  }

  private validateActivation(session: AttendanceSession, now: Date) {
    if (
      [
        ...(session.mode === AttendanceSessionMode.GEOLOCATION
          ? [
              session.latitude,
              session.longitude,
              session.radiusMeters,
              session.maximumAcceptedAccuracy,
            ]
          : []),
        session.startsAt,
        session.endsAt,
      ].some((value) => value == null)
    )
      throw new BadRequestException(
        session.mode === AttendanceSessionMode.QR
          ? 'QR_CONFIGURATION_INCOMPLETE'
          : 'GEO_CONFIGURATION_INCOMPLETE',
      );
    if (session.startsAt! >= session.endsAt!) throw new BadRequestException('INVALID_TIME_WINDOW');
    if (now >= session.endsAt!) throw new ConflictException('SESSION_WINDOW_EXPIRED');
    if (attendanceDateValue(session.date) !== attendanceAcademicDate(session.startsAt!))
      throw new BadRequestException('SESSION_DATE_INVALID');
    // Existing Semester HTTP contracts use ISO instants / Date. Do not reinterpret
    // those loaded boundaries, assume a new offset, or extend the final day.
    const semester = session.assistantEnrollment.semester;
    if (
      !(semester.startDate instanceof Date) ||
      !(semester.endDate instanceof Date) ||
      !Number.isFinite(semester.startDate.getTime()) ||
      !Number.isFinite(semester.endDate.getTime())
    )
      throw new ConflictException('SEMESTER_BOUNDARIES_INVALID');
    if (session.startsAt! < semester.startDate || session.endsAt! > semester.endDate)
      throw new BadRequestException('OUTSIDE_SEMESTER');
  }

  async activateSession(idUser: number, idSession: number, openNow = false) {
    return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
      this.requireSelfRegistrationDraft(session, now);
      if (openNow) {
        session.startsAt = now;
        session.date = attendanceAcademicDate(now) as unknown as Date;
      }
      this.validateActivation(session, now);
      await this.ensureDateAvailable(session, manager);
      if (
        await manager
          .getRepository(Attendance)
          .countBy({ attendanceSession: { idAttendanceSession: idSession } })
      )
        throw new ConflictException('SESSION_HAS_ATTENDANCE');
      session.openedAt = now;
      const response = attendanceSessionResponse(session, now);
      await manager.getRepository(AttendanceSession).save(session);
      return response;
    });
  }

  async closeSession(idUser: number, idSession: number) {
    return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
      if (!isSelfRegistrationMode(session.mode))
        throw new BadRequestException('SESSION_NOT_GEOLOCATION');
      const state = getAttendanceSessionState(session, now);
      if (state !== State.OPEN)
        throw new ConflictException(
          state === State.CLOSED ? 'SESSION_ALREADY_CLOSED' : 'SESSION_NOT_OPEN',
        );
      session.closedAt = now;
      await manager.getRepository(AttendanceSession).save(session);
      return attendanceSessionResponse(session, now);
    });
  }

  async cancelSession(idUser: number, idSession: number) {
    return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
      if (!isSelfRegistrationMode(session.mode))
        throw new BadRequestException('SESSION_NOT_GEOLOCATION');
      const state = getAttendanceSessionState(session, now);
      if (state !== State.DRAFT && state !== State.SCHEDULED)
        throw new ConflictException('SESSION_CANNOT_CANCEL');
      if (
        await manager
          .getRepository(Attendance)
          .countBy({ attendanceSession: { idAttendanceSession: idSession } })
      )
        throw new ConflictException('SESSION_HAS_ATTENDANCE');
      session.cancelledAt = now;
      await manager.getRepository(AttendanceSession).save(session);
      return attendanceSessionResponse(session, now);
    });
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
    const now = new Date();
    return sessions.map((session) => {
      const summary = summarizeAttendanceStatuses(
        session.attendances
          .filter((record) => studentIds.has(record.enrollment.idEnrollment))
          .map((record) => record.status),
        students.length,
        weight,
      );
      return {
        ...attendanceSessionResponse(session, now),
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        presentCount: summary.present,
        excusedCount: summary.excused,
        absentCount: isAttendanceSessionComputable(session, now) ? summary.absent : 0,
        pendingCount: getAttendanceSessionState(session, now) === State.OPEN ? summary.absent : 0,
        totalStudents: summary.total,
        percentage: isAttendanceSessionComputable(session, now) ? summary.percentage : 0,
      };
    });
  }

  async getSession(
    idUser: number,
    idSession: number,
    includeMarks = true,
    allowGeolocation = false,
    manager?: EntityManager,
  ): Promise<AttendanceSession> {
    const session = await (
      manager?.getRepository(AttendanceSession) ?? this.attendanceSessionRepository
    ).findOne({
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

    // Generic legacy mutations remain protected. Lifecycle-aware callers opt in explicitly.
    if (
      !allowGeolocation &&
      (isSelfRegistrationMode(session.mode) ||
        session.attendances?.some(
          (mark) =>
            mark.registrationMethod === AttendanceRegistrationMethod.GEOLOCATION ||
            mark.registrationMethod === AttendanceRegistrationMethod.QR,
        ))
    ) {
      throw new ForbiddenException('SESSION_REQUIRES_LIFECYCLE_OPERATION');
    }

    if (!session.assistantEnrollment?.user || session.assistantEnrollment.user.idUser !== idUser) {
      throw new ForbiddenException('No tienes permisos para gestionar esta sesión');
    }

    if (
      !session.assistantEnrollment.isActive ||
      session.assistantEnrollment.role !== CourseRelations.ASSISTANT
    ) {
      throw new ForbiddenException('La matrícula del auxiliar no está activa');
    }

    if (
      isSelfRegistrationMode(session.mode) &&
      (!session.assistantEnrollment.course || !session.assistantEnrollment.semester)
    )
      throw new ConflictException('SESSION_ACADEMIC_CONTEXT_INVALID');

    return session;
  }

  async getSessionDetail(idUser: number, idSession: number) {
    const session = await this.getSession(idUser, idSession, true, true);
    return { ...session, ...attendanceSessionResponse(session, new Date()) };
  }

  async getSessionPage(idUser: number, idSession: number, query: StudentRosterQueryDto) {
    const session = await this.getSession(idUser, idSession, false, true);
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
    const now = new Date();
    const computable = isAttendanceSessionComputable(session, now);
    return {
      data: {
        ...attendanceSessionResponse(session, now),
        idAttendanceSession: session.idAttendanceSession,
        date: session.date,
        students: roster.data,
        attendances: marks.map((mark) => ({
          ...mark,
          observation: mark.status === AttendanceStatus.EXCUSED ? mark.observation : null,
        })),
        presentCount: summary.present,
        excusedCount: summary.excused,
        absentCount: computable ? summary.absent : 0,
        pendingCount: getAttendanceSessionState(session, now) === State.OPEN ? summary.absent : 0,
        totalStudents: total,
        percentage: computable ? summary.percentage : 0,
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
    const session = await this.getSession(idUser, idSession, false, true);

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
      const locked = await manager.getRepository(AttendanceSession).findOneOrFail({
        where: { idAttendanceSession: idSession },
        lock: { mode: 'pessimistic_write' },
      });
      if (isSelfRegistrationMode(locked.mode))
        await this.getSession(idUser, idSession, false, true, manager);
      const now = new Date();
      if (isSelfRegistrationMode(locked.mode)) {
        const state = getAttendanceSessionState(locked, now);
        if (state !== State.OPEN && state !== State.CLOSED)
          throw new ConflictException('SESSION_NOT_OPEN');
        if (
          dto.markAll &&
          (await manager.getRepository(Attendance).countBy({
            attendanceSession: { idAttendanceSession: idSession },
            registrationMethod: AttendanceRegistrationMethod.GEOLOCATION,
          }))
        )
          throw new ConflictException('SESSION_HAS_GEO_EVIDENCE');
      }
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
      if (
        existing.some(
          (record) =>
            record.registrationMethod === AttendanceRegistrationMethod.GEOLOCATION ||
            record.registrationMethod === AttendanceRegistrationMethod.QR,
        )
      ) {
        throw new ForbiddenException('No se puede sobrescribir evidencia GEOLOCATION o QR');
      }
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
            registrationMethod: AttendanceRegistrationMethod.MANUAL,
            markedAt: now,
            markedBy: { idUser },
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

    const now = new Date();
    const [academic, permissionWeight] = await Promise.all([
      academicAttendanceCounts(
        this.attendanceRepository,
        assistantEnrollment.idEnrollment,
        [studentEnrollment.idEnrollment],
        now,
      ),
      this.getPermissionWeight(assistantEnrollment),
    ]);
    const counts = academic[0];
    const totalSessions = counts?.total ?? 0;
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
    const owned = await this.getSession(idUser, idSession, true, true);
    if (isSelfRegistrationMode(owned.mode))
      throw new ConflictException('SESSION_USE_GEO_CONFIGURATION');
    if (
      owned.attendances?.some(
        (mark) =>
          mark.registrationMethod === AttendanceRegistrationMethod.GEOLOCATION ||
          mark.registrationMethod === AttendanceRegistrationMethod.QR,
      )
    )
      throw new ForbiddenException('No se puede sobrescribir evidencia GEOLOCATION o QR');
    const session = owned;
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
    const owned = await this.getSession(idUser, idSession, true, true);
    if (isSelfRegistrationMode(owned.mode)) {
      return this.withLockedSession(idUser, idSession, async (session, manager, now) => {
        if (getAttendanceSessionState(session, now) !== State.DRAFT)
          throw new ConflictException('SESSION_CANNOT_DELETE');
        if (
          await manager.getRepository(Attendance).countBy({
            attendanceSession: { idAttendanceSession: idSession },
          })
        )
          throw new ConflictException('SESSION_HAS_ATTENDANCE');
        await manager.getRepository(AttendanceSession).delete({ idAttendanceSession: idSession });
        return { message: 'Sesión de asistencia eliminada' };
      });
    }
    if (
      owned.attendances?.some(
        (mark) =>
          mark.registrationMethod === AttendanceRegistrationMethod.GEOLOCATION ||
          mark.registrationMethod === AttendanceRegistrationMethod.QR,
      )
    )
      throw new ForbiddenException('No se puede eliminar evidencia GEOLOCATION o QR');
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
      registrationMethod: AttendanceRegistrationMethod.MANUAL,
    });
    if (!result.affected) throw new NotFoundException('Asistencia no encontrada');
    return { message: 'Asistencia eliminada' };
  }
}
