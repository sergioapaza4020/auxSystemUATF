import { activeCriteria } from '@repo/grade-calculations';
import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { getStudentRosterPage } from '@common/utils/student-roster';
import {
  averageScores,
  criterionScore,
  isAttendanceCriterion,
  totalScore,
  weightedScore,
} from '@repo/grade-calculations';
import { attendanceSummary } from '@common/utils/attendance-summary';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import type {
  IndividualStudentGradeSummaryDto,
  StudentGradeSummaryDto,
} from 'src/dtos/enrollments/student-grade-summary.dto';
import { Activity } from 'src/entities/activities/activity.entity';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { EnrollmentQueryDto } from 'src/dtos/enrollments/enrollment-query.dto';
import { withActiveActivities } from '@common/utils/active-activities';
import { statusFilter } from '@common/utils/status-filter';
import { Grade } from 'src/entities/grades/grades.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { EnrollmentUpdateDto } from 'src/dtos/enrollments/enrollments-update.dto';
import { CourseRelations } from '@common/enums/courseRelations';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentCreateDto } from 'src/dtos/enrollments/enrollments.dto';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { EntityManager, In, Repository } from 'typeorm';
import { SemestersService } from '../semesters/semesters.service';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { SemesterNumber } from '@common/enums/semesterNumber';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly usersService: UsersService,
    private readonly semestersService: SemestersService,
    private readonly coursesService: CoursesService,
  ) {}

  async getAll(status: RecordStatus = RecordStatus.ACTIVE): Promise<Enrollment[]> {
    return this.enrollmentRepository.find({
      where: statusFilter(status),
      relations: {
        semester: true,
        course: true,
        user: true,
      },
    });
  }

  private async resolveEnrollment(dto: EnrollmentCreateDto) {
    dto.semester = dto.semester.toUpperCase();
    if (!/^(I|II)-\d{4}$/.test(dto.semester))
      throw new BadRequestException('Formato de semestre inválido');
    dto.courseCode = dto.courseCode.toUpperCase();

    const user = await this.usersService.getOneByUsername(dto.username);
    if (!user) throw new NotFoundException('Estudiante no encontrado o inactivo');

    const separatorIdx = dto.semester.indexOf('-');
    const period: SemesterNumber =
      dto.semester.substring(0, separatorIdx) === 'I' ? SemesterNumber.I : SemesterNumber.II;
    const year: number = Number(dto.semester.substring(separatorIdx + 1, dto.semester.length));
    const semester = await this.semestersService.getOneByPeriodYear(period, year);
    if (!semester) throw new NotFoundException('Semestre no encontrado o inactivo');

    const course = await this.coursesService.getOneByCode(dto.courseCode);
    if (!course) throw new NotFoundException('Materia no encontrada o inactivo');

    const hasRequiredRole = user.roles.some((role) => (role.name as CourseRelations) === dto.role);
    if (!hasRequiredRole)
      throw new BadRequestException(
        `El usuario ${dto.username} no tiene el rol necesario (${dto.role}) para esta inscripción`,
      );

    return { user, semester, course, role: dto.role };
  }

  async getPage(query: EnrollmentQueryDto) {
    const { page = 1, limit = 20 } = query;
    const qb = this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.user', 'user')
      .leftJoinAndSelect('enrollment.course', 'course')
      .leftJoinAndSelect('enrollment.semester', 'semester')
      .where(statusFilter(query.status));
    if (query.search?.trim())
      qb.andWhere(
        '(user.name ILIKE :search OR user.lastname ILIKE :search OR user.username ILIKE :search OR user.ci ILIKE :search OR user.ru ILIKE :search OR course.code ILIKE :search OR course.name ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    if (query.courseId) qb.andWhere('course.idCourse = :courseId', { courseId: query.courseId });
    if (query.semesterId)
      qb.andWhere('semester.idSemester = :semesterId', { semesterId: query.semesterId });
    if (query.role) qb.andWhere('enrollment.role = :role', { role: query.role });
    const [data, total] = await qb
      .orderBy('enrollment.idEnrollment', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(dto: EnrollmentCreateDto) {
    const data = await this.resolveEnrollment({ ...dto });
    const existing = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: data.user.idUser },
        semester: { idSemester: data.semester.idSemester },
        course: { idCourse: data.course.idCourse },
      },
    });
    if (existing)
      throw new ConflictException(
        'El usuario ya está matriculado en esta materia durante este semestre',
      );
    return this.enrollmentRepository.save(this.enrollmentRepository.create(data));
  }

  async getOneById(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { idEnrollment, isActive: true },
      relations: { user: true, semester: true, course: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  async update(idEnrollment: number, dto: EnrollmentUpdateDto) {
    const enrollment = await this.getOneById(idEnrollment);
    const data = await this.resolveEnrollment({
      username: dto.username ?? enrollment.user.username,
      semester:
        dto.semester ??
        `${enrollment.semester.period === SemesterNumber.I ? 'I' : 'II'}-${enrollment.semester.year}`,
      courseCode: dto.courseCode ?? enrollment.course.code,
      role: dto.role ?? enrollment.role,
    });
    const duplicate = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: data.user.idUser },
        semester: { idSemester: data.semester.idSemester },
        course: { idCourse: data.course.idCourse },
      },
    });
    if (duplicate && duplicate.idEnrollment !== idEnrollment)
      throw new ConflictException('La matrícula ya existe');
    const changesIdentity =
      enrollment.user.idUser !== data.user.idUser ||
      enrollment.course.idCourse !== data.course.idCourse ||
      enrollment.semester.idSemester !== data.semester.idSemester ||
      enrollment.role !== data.role;
    if (changesIdentity) {
      const manager = this.enrollmentRepository.manager;
      const records = await Promise.all([
        manager.getRepository(Grade).countBy({ enrollment: { idEnrollment } }),
        manager.getRepository(Attendance).countBy({ enrollment: { idEnrollment } }),
        manager.getRepository(AttendanceSession).countBy({ assistantEnrollment: { idEnrollment } }),
        manager.getRepository(GradeScheme).countBy({ assistantEnrollment: { idEnrollment } }),
      ]);
      if (records.some((count) => count > 0)) {
        throw new ConflictException(
          'No se puede reasignar una matrícula con notas, asistencias o configuraciones registradas',
        );
      }
    }
    this.enrollmentRepository.merge(enrollment, data);
    return this.enrollmentRepository.save(enrollment);
  }

  async delete(idEnrollment: number) {
    const enrollment = await this.getOneById(idEnrollment);
    enrollment.isActive = false;
    return this.enrollmentRepository.save(enrollment);
  }

  async reactivate(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { idEnrollment, isActive: false },
      relations: { user: true, semester: true, course: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula inactiva no encontrada');
    await this.resolveEnrollment({
      username: enrollment.user.username,
      semester: `${enrollment.semester.period === SemesterNumber.I ? 'I' : 'II'}-${enrollment.semester.year}`,
      courseCode: enrollment.course.code,
      role: enrollment.role,
    });
    enrollment.isActive = true;
    return this.enrollmentRepository.save(enrollment);
  }

  async getUserEnrollments(idUser: number, current = false) {
    const user = await this.usersService.getOneById(idUser);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (current) {
      let semester: { idSemester: number };
      try {
        semester = await this.semestersService.getCurrentSemester();
      } catch (error) {
        if (error instanceof NotFoundException) return [];
        throw error;
      }
      return this.enrollmentRepository.find({
        where: {
          user: { idUser },
          isActive: true,
          role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
          semester: { idSemester: semester.idSemester },
        },
        relations: { course: true, semester: true },
        select: {
          idEnrollment: true,
          role: true,
          isActive: true,
          course: { idCourse: true, code: true, name: true, group: true, isActive: true },
          semester: {
            idSemester: true,
            year: true,
            period: true,
            startDate: true,
            endDate: true,
            isActive: true,
          },
        },
        order: { course: { code: 'ASC' }, idEnrollment: 'ASC' },
      });
    }

    const enrollments = await this.enrollmentRepository.find({
      where: [
        {
          user: {
            idUser: user.idUser,
          },
          isActive: true,
          role: CourseRelations.STUDENT,
        },
        {
          user: {
            idUser: user.idUser,
          },
          isActive: true,
          role: CourseRelations.ASSISTANT,
        },
      ],
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
              activities: true,
            },
          },
        },
      },
      order: {
        course: {
          code: 'ASC',
        },
      },
    });

    for (const enrollment of enrollments) {
      withActiveActivities(enrollment.course.gradeScheme);
    }
    return enrollments;
  }

  async getMyEnrollment(idUser: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        user: {
          idUser,
        },
        isActive: true,
        role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
      },
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
              activities: true,
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('La matrícula no existe o no pertenece al usuario');
    }

    withActiveActivities(enrollment.course.gradeScheme);
    return enrollment;
  }

  async getManagedEnrollment(
    idAssistant: number,
    idEnrollment: number,
    includeCourseScheme = true,
  ) {
    const enrollment = await this.verifyAssistantAccess(idAssistant, idEnrollment);

    const fullEnrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: enrollment.idEnrollment,
        isActive: true,
      },
      relations: {
        user: true,
        semester: true,
        course: includeCourseScheme
          ? { gradeScheme: { details: { gradeItem: true, activities: true } } }
          : true,
      },
    });

    if (!fullEnrollment) {
      throw new NotFoundException('La matrícula del estudiante no existe');
    }

    withActiveActivities(fullEnrollment.course.gradeScheme);
    return fullEnrollment;
  }

  async getAssistantEnrollment(
    idAssistant: number,
    idEnrollment: number,
    manager: EntityManager = this.enrollmentRepository.manager,
  ) {
    const enrollment = await manager.getRepository(Enrollment).findOne({
      where: {
        idEnrollment,
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
      relations: {
        course: true,
        semester: true,
        user: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación de auxiliar no encontrada');
    }

    if (enrollment.user.idUser !== idAssistant) {
      throw new ForbiddenException('No tienes permisos para gestionar esta materia');
    }

    return enrollment;
  }

  async getStudentsPage(idAssistant: number, idEnrollment: number, query: StudentRosterQueryDto) {
    const assistant = await this.getAssistantEnrollment(idAssistant, idEnrollment);
    return getStudentRosterPage(this.enrollmentRepository, assistant, query);
  }

  async getIndividualStudentGradeSummary(
    idAssistant: number,
    idEnrollment: number,
    studentEnrollmentId: number,
  ): Promise<IndividualStudentGradeSummaryDto> {
    const assistant = await this.getAssistantEnrollment(idAssistant, idEnrollment);
    const student = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: studentEnrollmentId,
        course: { idCourse: assistant.course.idCourse },
        semester: { idSemester: assistant.semester.idSemester },
        role: CourseRelations.STUDENT,
        isActive: true,
      },
      select: { idEnrollment: true },
    });
    if (!student) throw new NotFoundException('No se encontró al estudiante en esta materia.');
    const summary = await this.getStudentGradeSummary(idAssistant, idEnrollment, [student]);
    return { scheme: summary.scheme, student: summary.students[0] };
  }

  async getStudentGradeSummaryPage(
    idAssistant: number,
    idEnrollment: number,
    query: StudentRosterQueryDto,
  ) {
    const roster = await this.getStudentsPage(idAssistant, idEnrollment, query);
    const summary = await this.getStudentGradeSummary(idAssistant, idEnrollment, roster.data);
    return { data: { ...summary, roster: roster.data }, meta: roster.meta };
  }

  async getStudentsByEnrollment(idAssistant: number, idEnrollment: number) {
    const enrollment = await this.getAssistantEnrollment(idAssistant, idEnrollment);

    const students = await this.enrollmentRepository.find({
      where: {
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        isActive: true,
        role: CourseRelations.STUDENT,
      },
      relations: {
        user: true,
      },
      order: {
        user: {
          lastname: 'ASC',
          name: 'ASC',
        },
        idEnrollment: 'ASC',
      },
    });

    return students;
  }

  async getStudentGradeSummary(
    idAssistant: number,
    idEnrollment: number,
    pageStudents?: Enrollment[],
  ): Promise<StudentGradeSummaryDto> {
    // Reuse ownership, active enrollment, semester and student ordering checks.
    const students =
      pageStudents ?? (await this.getStudentsByEnrollment(idAssistant, idEnrollment));
    const manager = this.enrollmentRepository.manager;
    const scheme = await manager.getRepository(GradeScheme).findOne({
      where: { assistantEnrollment: { idEnrollment }, isActive: true },
      relations: { details: { gradeItem: true } },
    });
    if (!scheme)
      return {
        scheme: null,
        students: students.map((student) => ({
          idEnrollment: student.idEnrollment,
          details: [],
          totalRaw: null,
          assistantContribution: null,
        })),
      };
    const details = activeCriteria(scheme.details).sort(
      (a, b) => a.order - b.order || a.idGradeSchemeDetail - b.idGradeSchemeDetail,
    );
    const multiplier = Number(scheme.assistantPercentage ?? 100) / 100;
    const result: StudentGradeSummaryDto = {
      scheme: {
        idGradeScheme: scheme.idGradeScheme,
        assistantPercentage: Number(scheme.assistantPercentage ?? 100),
        details: details.map((detail) => ({
          idGradeSchemeDetail: detail.idGradeSchemeDetail,
          name: detail.gradeItem.name,
          percentage: Number(detail.percentage),
          maximumScore: weightedScore(100, Number(detail.percentage), multiplier) ?? 0,
        })),
      },
      students: [],
    };
    if (!details.length || !students.length) {
      result.students = students.map((student) => ({
        idEnrollment: student.idEnrollment,
        details: [],
        totalRaw: null,
        assistantContribution: null,
      }));
      return result;
    }
    const studentIds = students.map((student) => student.idEnrollment);
    // Fixed number of grouped queries; no activity payloads or per-student SQL.
    const [activityCounts, gradeScores, sessions, presences] = await Promise.all([
      manager
        .getRepository(Activity)
        .createQueryBuilder('activity')
        .select('activity.id_grade_scheme_detail', 'detailId')
        .addSelect('COUNT(*)', 'count')
        .innerJoin('activity.gradeSchemeDetail', 'detail')
        .where('detail.id_grade_scheme = :schemeId', { schemeId: scheme.idGradeScheme })
        .andWhere('activity.isActive = true')
        .groupBy('activity.id_grade_scheme_detail')
        .getRawMany<{ detailId: number; count: string }>(),
      manager
        .getRepository(Grade)
        .createQueryBuilder('grade')
        .select('grade.id_enrollment', 'enrollmentId')
        .addSelect('grade.id_grade_scheme_detail', 'detailId')
        .addSelect('SUM(grade.score) FILTER (WHERE grade.id_activity IS NOT NULL)', 'activityTotal')
        .addSelect('MAX(grade.score) FILTER (WHERE grade.id_activity IS NULL)', 'directScore')
        .innerJoin('grade.gradeSchemeDetail', 'detail')
        .leftJoin('grade.activity', 'activity')
        .where('detail.id_grade_scheme = :schemeId', { schemeId: scheme.idGradeScheme })
        .andWhere('grade.id_enrollment IN (:...studentIds)', { studentIds })
        .andWhere(
          '(grade.id_activity IS NULL OR (activity.isActive = true AND activity.deletedAt IS NULL AND activity.id_grade_scheme_detail = grade.id_grade_scheme_detail))',
        )
        .groupBy('grade.id_enrollment')
        .addGroupBy('grade.id_grade_scheme_detail')
        .getRawMany<{
          enrollmentId: number;
          detailId: number;
          activityTotal: string | null;
          directScore: string | null;
        }>(),
      manager.getRepository(AttendanceSession).countBy({ assistantEnrollment: { idEnrollment } }),
      manager
        .getRepository(Attendance)
        .createQueryBuilder('attendance')
        .select('attendance.id_enrollment', 'enrollmentId')
        .addSelect('COUNT(*) FILTER (WHERE attendance.status = :present)', 'count')
        .addSelect('COUNT(*) FILTER (WHERE attendance.status = :excused)', 'excused')
        .setParameters({ present: AttendanceStatus.PRESENT, excused: AttendanceStatus.EXCUSED })
        .innerJoin('attendance.attendanceSession', 'session')
        .where('session.id_assistant_enrollment = :idEnrollment', { idEnrollment })
        .andWhere('attendance.id_enrollment IN (:...studentIds)', { studentIds })
        .groupBy('attendance.id_enrollment')
        .getRawMany<{ enrollmentId: number; count: string; excused: string }>(),
    ]);
    const counts = new Map(activityCounts.map((row) => [Number(row.detailId), Number(row.count)]));
    const scores = new Map(gradeScores.map((row) => [`${row.enrollmentId}:${row.detailId}`, row]));
    const presentCounts = new Map(
      presences.map((row) => [
        Number(row.enrollmentId),
        { present: Number(row.count), excused: Number(row.excused ?? 0) },
      ]),
    );
    result.students = students.map((student) => {
      const studentDetails = details.map((detail) => {
        const grade = scores.get(`${student.idEnrollment}:${detail.idGradeSchemeDetail}`);
        const rawScore = criterionScore({
          attendance: isAttendanceCriterion(detail.gradeItem.name)
            ? {
                totalSessions: sessions,
                percentage: attendanceSummary(
                  presentCounts.get(student.idEnrollment)?.present ?? 0,
                  presentCounts.get(student.idEnrollment)?.excused ?? 0,
                  sessions,
                  Number(detail.permissionWeight ?? 1),
                ).percentage,
              }
            : undefined,
          activityCount: counts.get(detail.idGradeSchemeDetail) ?? 0,
          activityScore: averageScores(
            [grade?.activityTotal ?? null],
            counts.get(detail.idGradeSchemeDetail) ?? 0,
          ),
          directScore: grade?.directScore == null ? null : Number(grade.directScore),
        });
        return {
          idGradeSchemeDetail: detail.idGradeSchemeDetail,
          rawScore,
          weightedScore: weightedScore(rawScore, Number(detail.percentage), multiplier),
        };
      });
      const totalRaw = totalScore(
        studentDetails.map((detail, index) => ({
          score: detail.rawScore,
          percentage: Number(details[index].percentage),
        })),
      );
      return {
        idEnrollment: student.idEnrollment,
        details: studentDetails,
        totalRaw,
        assistantContribution: weightedScore(totalRaw, Number(scheme.assistantPercentage ?? 100)),
      };
    });
    return result;
  }

  private async verifyAssistantAccess(idAssistant: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        isActive: true,
        role: CourseRelations.STUDENT,
      },
      relations: {
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación del estudiante no encontrada');
    }

    const assistantEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: idAssistant },
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
    });

    if (!assistantEnrollment) {
      throw new ForbiddenException('No tienes permisos para gestionar esta matrícula');
    }

    return enrollment;
  }
}
