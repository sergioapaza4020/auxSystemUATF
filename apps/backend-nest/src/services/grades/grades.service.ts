import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { getStudentRosterPage } from '@common/utils/student-roster';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { ACTIVITY_ORDER } from '@common/utils/activity-rules';
import {
  assertGradeActivity,
  assertGradeSchemeAccess,
  assertGradeScore,
} from '@common/utils/grade-rules';
import { isAttendanceCriterion } from '@repo/grade-calculations';
import { CourseRelations } from '@common/enums/courseRelations';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import type { GradeMatrixDto } from 'src/dtos/grades/grade-matrix.dto';
import type { BulkActivityGradesDto } from 'src/dtos/grades/bulk-activity-grades.dto';

import { CreateGradeDto } from 'src/dtos/grades/create-grade.dto';
import { UpdateGradeDto } from 'src/dtos/grades/update-grade.dto';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { Activity } from 'src/entities/activities/activity.entity';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepository: Repository<Grade>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  async create(idUser: number, dto: CreateGradeDto) {
    assertGradeScore(dto.score);
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: dto.enrollmentId,
      },
      relations: {
        course: {
          gradeScheme: true,
        },
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación no encontrada');
    }

    await this.enrollmentsService.getManagedEnrollment(idUser, dto.enrollmentId);

    const detail = await this.gradeSchemeDetailRepository.findOne({
      where: {
        idGradeSchemeDetail: dto.gradeSchemeDetailId,
      },
      relations: {
        gradeScheme: {
          assistantEnrollment: {
            user: true,
            course: true,
            semester: true,
          },
        },
        gradeItem: true,
      },
    });

    if (!detail) {
      throw new NotFoundException('Detalle del esquema de notas no encontrado');
    }

    assertGradeSchemeAccess(idUser, enrollment, detail);

    let activity: Activity | null = null;

    if (dto.activityId !== undefined) {
      activity = await this.activityRepository.findOne({
        where: {
          idActivity: dto.activityId,
          isActive: true,
        },
        relations: {
          gradeSchemeDetail: {
            gradeScheme: true,
          },
        },
      });

      assertGradeActivity(activity, detail);
    }

    let existing: Grade | null = null;

    if (activity) {
      existing = await this.gradeRepository.findOne({
        where: {
          enrollment: {
            idEnrollment: enrollment.idEnrollment,
          },
          activity: {
            idActivity: activity.idActivity,
          },
        },
      });
    } else {
      existing = await this.gradeRepository
        .createQueryBuilder('grade')
        .leftJoin('grade.enrollment', 'enrollment')
        .leftJoin('grade.gradeSchemeDetail', 'gradeSchemeDetail')
        .where('enrollment.id_enrollment = :idEnrollment', {
          idEnrollment: enrollment.idEnrollment,
        })
        .andWhere('gradeSchemeDetail.id_grade_scheme_detail = :idGradeSchemeDetail', {
          idGradeSchemeDetail: detail.idGradeSchemeDetail,
        })
        .andWhere('grade.id_activity IS NULL')
        .getOne();
    }

    if (existing) {
      throw new ConflictException(
        activity
          ? 'Ya existe una nota para esta actividad'
          : 'Ya existe una nota para este componente',
      );
    }

    const grade = this.gradeRepository.create({
      enrollment,
      gradeSchemeDetail: detail,
      activity,
      score: dto.score,
    });

    try {
      return await this.gradeRepository.save(grade);
    } catch (error) {
      const databaseError =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string; constraint?: string })
          : null;
      if (
        databaseError?.code === '23505' &&
        databaseError.constraint === 'UQ_grade_enrollment_activity'
      ) {
        throw new ConflictException('Ya existe una nota para esta actividad');
      }
      throw error;
    }
  }

  async getByEnrollment(idUser: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
      },
      relations: {
        user: true,
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación no encontrada');
    }

    if (enrollment.user.idUser !== idUser) {
      await this.enrollmentsService.getManagedEnrollment(idUser, idEnrollment, false);
    }

    return this.gradeRepository.find({
      where: [
        { enrollment: { idEnrollment }, activity: IsNull() },
        { enrollment: { idEnrollment }, activity: { isActive: true, deletedAt: IsNull() } },
      ],
      relations: {
        gradeSchemeDetail: {
          gradeItem: true,
          gradeScheme: true,
        },
        activity: true,
      },
      order: {
        gradeSchemeDetail: {
          order: 'ASC',
        },
        activity: ACTIVITY_ORDER,
      },
    });
  }

  async getOne(idUser: number, idGrade: number) {
    const grade = await this.gradeRepository.findOne({
      where: {
        idGrade,
      },
      relations: {
        enrollment: {
          user: true,
          course: true,
          semester: true,
        },
        gradeSchemeDetail: {
          gradeItem: true,
          gradeScheme: true,
        },
        activity: true,
      },
    });

    if (!grade) {
      throw new NotFoundException('Nota no encontrada');
    }

    if (grade.enrollment.user.idUser !== idUser) {
      await this.enrollmentsService.getManagedEnrollment(idUser, grade.enrollment.idEnrollment);
    }

    return grade;
  }

  async update(idUser: number, idGrade: number, dto: UpdateGradeDto) {
    const grade = await this.getOne(idUser, idGrade);

    if (dto.score !== undefined) {
      assertGradeScore(dto.score);
      grade.score = dto.score;
    }

    return this.gradeRepository.save(grade);
  }

  async remove(idUser: number, idGrade: number) {
    const grade = await this.getOne(idUser, idGrade);

    await this.gradeRepository.remove(grade);

    return {
      message: 'Nota eliminada correctamente',
    };
  }

  async getMatrix(
    idUser: number,
    idAssistantEnrollment: number,
    detailId?: number,
    query?: StudentRosterQueryDto,
  ): Promise<GradeMatrixDto> {
    const assistant = await this.enrollmentsService.getAssistantEnrollment(
      idUser,
      idAssistantEnrollment,
    );
    const manager = this.gradeRepository.manager;
    const scheme = await manager.getRepository(GradeScheme).findOne({
      where: { assistantEnrollment: { idEnrollment: idAssistantEnrollment }, isActive: true },
      relations: { details: { gradeItem: true } },
    });
    const matrix: GradeMatrixDto = {
      enrollment: {
        idEnrollment: assistant.idEnrollment,
        idCourse: assistant.course.idCourse,
        code: assistant.course.code,
        name: assistant.course.name,
        group: assistant.course.group,
        assistantName: `${assistant.user.name} ${assistant.user.lastname}`,
      },
      scheme: scheme
        ? {
            idGradeScheme: scheme.idGradeScheme,
            assistantPercentage: Number(scheme.assistantPercentage ?? 100),
          }
        : null,
      criteria: [],
      detail: null,
      activities: [],
      students: [],
      grades: [],
    };
    const roster = query
      ? await getStudentRosterPage(manager.getRepository(Enrollment), assistant, query)
      : undefined;
    if (roster) matrix.meta = roster.meta;
    if (!scheme) return matrix;
    const details = [...scheme.details]
      .filter((detail) => !isAttendanceCriterion(detail.gradeItem.name))
      .sort((a, b) => a.order - b.order || a.idGradeSchemeDetail - b.idGradeSchemeDetail);
    const counts = await manager
      .getRepository(Activity)
      .createQueryBuilder('activity')
      .select('activity.id_grade_scheme_detail', 'detailId')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('activity.gradeSchemeDetail', 'detail')
      .where('detail.id_grade_scheme = :schemeId', { schemeId: scheme.idGradeScheme })
      .andWhere('activity.isActive = true')
      .groupBy('activity.id_grade_scheme_detail')
      .getRawMany<{ detailId: number; count: string }>();
    const activityCounts = new Map(counts.map((row) => [Number(row.detailId), Number(row.count)]));
    matrix.criteria = details.map((detail) => ({
      idGradeSchemeDetail: detail.idGradeSchemeDetail,
      name: detail.gradeItem.name,
      percentage: Number(detail.percentage),
      activityCount: activityCounts.get(detail.idGradeSchemeDetail) ?? 0,
    }));
    const detail =
      detailId === undefined
        ? (details.find((item) => activityCounts.has(item.idGradeSchemeDetail)) ?? details[0])
        : details.find((item) => item.idGradeSchemeDetail === detailId);
    if (detailId !== undefined && !detail)
      throw new BadRequestException(
        'El criterio no pertenece al esquema de actividades del auxiliar',
      );
    if (!detail) return matrix;
    matrix.detail = {
      idGradeSchemeDetail: detail.idGradeSchemeDetail,
      name: detail.gradeItem.name,
      percentage: Number(detail.percentage),
    };
    const [activities, students] = await Promise.all([
      manager.getRepository(Activity).find({
        where: {
          gradeSchemeDetail: { idGradeSchemeDetail: detail.idGradeSchemeDetail },
          isActive: true,
          deletedAt: IsNull(),
        },
        select: {
          idActivity: true,
          name: true,
          dueDate: true,
          description: true,
          publicationDate: true,
        },
        order: ACTIVITY_ORDER,
      }),
      roster
        ? Promise.resolve(roster.data)
        : manager.getRepository(Enrollment).find({
            where: {
              course: { idCourse: assistant.course.idCourse },
              semester: { idSemester: assistant.semester.idSemester },
              role: CourseRelations.STUDENT,
              isActive: true,
            },
            select: {
              idEnrollment: true,
              user: { idUser: true, name: true, lastname: true, ci: true, ru: true },
            },
            relations: { user: true },
            order: { user: { lastname: 'ASC', name: 'ASC' }, idEnrollment: 'ASC' },
          }),
    ]);
    matrix.activities = activities.map((activity) => ({
      idActivity: activity.idActivity,
      name: activity.name,
      dueDate: activity.dueDate,
      description: activity.description ?? null,
      publicationDate: activity.publicationDate,
    }));
    matrix.students = students.map((student) => ({
      idEnrollment: student.idEnrollment,
      name: student.user.name,
      lastname: student.user.lastname,
      ci: student.user.ci == null ? null : String(student.user.ci),
      ru: student.user.ru == null ? null : String(student.user.ru),
    }));
    if (!activities.length || !students.length) return matrix;
    const grades = await manager
      .getRepository(Grade)
      .createQueryBuilder('grade')
      .select('grade.idGrade', 'idGrade')
      .addSelect('grade.id_enrollment', 'enrollmentId')
      .addSelect('grade.id_activity', 'activityId')
      .addSelect('grade.score', 'score')
      .where('grade.id_grade_scheme_detail = :detailId', { detailId: detail.idGradeSchemeDetail })
      .andWhere('grade.id_enrollment IN (:...studentIds)', {
        studentIds: students.map((student) => student.idEnrollment),
      })
      .andWhere('grade.id_activity IN (:...activityIds)', {
        activityIds: activities.map((activity) => activity.idActivity),
      })
      .getRawMany<{ idGrade: number; enrollmentId: number; activityId: number; score: string }>();
    matrix.grades = grades.map((grade) => ({
      ...grade,
      idGrade: Number(grade.idGrade),
      enrollmentId: Number(grade.enrollmentId),
      activityId: Number(grade.activityId),
      score: Number(grade.score),
    }));
    return matrix;
  }

  async saveBulk(
    user: Pick<JwtPayload, 'idUser' | 'roles' | 'permissions'>,
    idAssistantEnrollment: number,
    dto: BulkActivityGradesDto,
  ) {
    // The existing decorator is OR-based; mixed upserts must require BOTH write permissions.
    if (
      !user.roles.includes('SUPERADMIN') &&
      (!user.permissions.includes('grade.create') || !user.permissions.includes('grade.update'))
    ) {
      throw new ForbiddenException(
        'Se requieren los permisos para crear y actualizar calificaciones',
      );
    }
    if (!dto.grades.length || dto.grades.length > 1000)
      throw new BadRequestException('Envía entre 1 y 1000 calificaciones por operación');
    const keys = new Set<string>();
    for (const grade of dto.grades) {
      assertGradeScore(grade.score);
      const key = `${grade.enrollmentId}:${grade.activityId}`;
      if (keys.has(key))
        throw new BadRequestException('No se puede repetir una celda en la operación');
      keys.add(key);
    }
    return this.gradeRepository.manager.transaction(async (manager) => {
      const assistant = await this.enrollmentsService.getAssistantEnrollment(
        user.idUser,
        idAssistantEnrollment,
        manager,
      );
      const scheme = await manager.getRepository(GradeScheme).findOne({
        where: { assistantEnrollment: { idEnrollment: idAssistantEnrollment }, isActive: true },
        relations: { details: { gradeItem: true } },
      });
      if (!scheme) throw new NotFoundException('No existe un esquema activo del auxiliar');
      scheme.assistantEnrollment = assistant;
      const activityIds = [...new Set(dto.grades.map((grade) => grade.activityId))];
      const enrollmentIds = [...new Set(dto.grades.map((grade) => grade.enrollmentId))];
      const [activities, students] = await Promise.all([
        manager.getRepository(Activity).find({
          where: { idActivity: In(activityIds), isActive: true, deletedAt: IsNull() },
          relations: { gradeSchemeDetail: { gradeScheme: true } },
        }),
        manager.getRepository(Enrollment).find({
          where: {
            idEnrollment: In(enrollmentIds),
            course: { idCourse: assistant.course.idCourse },
            semester: { idSemester: assistant.semester.idSemester },
            role: CourseRelations.STUDENT,
            isActive: true,
          },
          relations: { course: true, semester: true },
        }),
      ]);
      const activityMap = new Map(activities.map((activity) => [activity.idActivity, activity]));
      const studentMap = new Map(students.map((student) => [student.idEnrollment, student]));
      const detailMap = new Map(
        scheme.details.map((detail) => [detail.idGradeSchemeDetail, detail]),
      );
      const values = dto.grades.map((input) => {
        const student = studentMap.get(input.enrollmentId);
        if (!student)
          throw new ForbiddenException(
            'Hay una matrícula que no pertenece a la materia y semestre del auxiliar',
          );
        const activity = activityMap.get(input.activityId);
        const detail = activity
          ? detailMap.get(activity.gradeSchemeDetail.idGradeSchemeDetail)
          : undefined;
        if (!detail || isAttendanceCriterion(detail.gradeItem.name))
          throw new ForbiddenException(
            'Hay una actividad que no pertenece a un criterio editable del auxiliar',
          );
        detail.gradeScheme = scheme;
        assertGradeSchemeAccess(user.idUser, student, detail);
        const validActivity = activity ?? null;
        assertGradeActivity(validActivity, detail);
        return {
          enrollment: { idEnrollment: student.idEnrollment },
          activity: { idActivity: validActivity.idActivity },
          gradeSchemeDetail: { idGradeSchemeDetail: detail.idGradeSchemeDetail },
          score: input.score,
        };
      });
      // One INSERT ... ON CONFLICT, not a save() or HTTP loop per cell.
      const result = await manager
        .getRepository(Grade)
        .createQueryBuilder()
        .insert()
        .into(Grade)
        .values(values)
        .onConflict(
          '("id_enrollment", "id_activity") WHERE "id_activity" IS NOT NULL DO UPDATE SET "score" = EXCLUDED."score"',
        )
        // Database names in an array are treated as entity property paths and omit relation FKs.
        .returning('"id_grade", "id_enrollment", "id_activity", "score"')
        .execute();
      const rows = result.raw as {
        id_grade: number;
        id_enrollment: number;
        id_activity: number;
        score: string;
      }[];
      return {
        grades: rows.map((row) => ({
          idGrade: Number(row.id_grade),
          enrollmentId: Number(row.id_enrollment),
          activityId: Number(row.id_activity),
          score: Number(row.score),
        })),
      };
    });
  }
}
