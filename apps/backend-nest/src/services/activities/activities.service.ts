import { CourseRelations } from '@common/enums/courseRelations';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityCreateDto } from 'src/dtos/activities/activity-create.dto';
import { ActivityUpdateDto } from 'src/dtos/activities/activity-update.dto';
import { Activity } from 'src/entities/activities/activity.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { EntityManager, Repository } from 'typeorm';
import { Course } from 'src/entities/courses/courses.entity';
import { ACTIVITY_ORDER } from '@common/utils/activity-rules';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  private async saveWithUniqueName(
    activity: Activity,
    idCourse: number,
    transaction?: EntityManager,
  ): Promise<Activity> {
    activity.name = activity.name.trim();
    if (!activity.name)
      throw new BadRequestException('El nombre de la actividad no puede estar vacío');

    const save = async (manager: EntityManager) => {
      // Serialize activity writes within the course; its identity is reached through relations,
      // so a simple unique index on activities cannot enforce course-wide uniqueness.
      await manager.getRepository(Course).findOneOrFail({
        where: { idCourse },
        lock: { mode: 'pessimistic_write' },
      });
      // Change the row version so a serializable import with an older snapshot
      // fails when taking the course lock after a concurrent activity write.
      const names = await this.listActiveNames(idCourse, manager, activity.idActivity);
      const normalizedName = activity.name.toLowerCase();
      if (names.some(({ name }) => name.trim().toLowerCase() === normalizedName)) {
        throw new ConflictException('Ya existe una actividad con ese nombre en esta materia.');
      }
      await manager.query('UPDATE "courses" SET "id_course" = "id_course" WHERE "id_course" = $1', [
        idCourse,
      ]);
      return manager.getRepository(Activity).save(activity);
    };
    return transaction ? save(transaction) : this.activityRepository.manager.transaction(save);
  }

  listActiveNames(idCourse: number, manager: EntityManager, excludeActivityId?: number) {
    const query = manager
      .getRepository(Activity)
      .createQueryBuilder('activity')
      .innerJoin('activity.gradeSchemeDetail', 'detail')
      .innerJoin('detail.gradeScheme', 'scheme')
      .leftJoin('scheme.assistantEnrollment', 'assistantEnrollment')
      .leftJoin('assistantEnrollment.course', 'assistantCourse')
      .leftJoin('scheme.courses', 'schemeCourse')
      .where('(assistantCourse.idCourse = :idCourse OR schemeCourse.idCourse = :idCourse)', {
        idCourse,
      })
      .andWhere('activity.isActive = :isActive', { isActive: true })
      .andWhere('activity.deletedAt IS NULL');
    if (excludeActivityId !== undefined) {
      query.andWhere('activity.idActivity != :idActivity', { idActivity: excludeActivityId });
    }
    // PostgreSQL's C locale does not lowercase accented letters. Compare names
    // consistently in JavaScript while retaining the course lock and SQL scope.
    return query.select('activity.name', 'name').getRawMany<{ name: string }>();
  }

  async getAll(): Promise<Activity[]> {
    return this.activityRepository.find({
      where: {
        isActive: true,
      },
      relations: {
        gradeSchemeDetail: {
          gradeItem: true,
        },
      },
      order: ACTIVITY_ORDER,
    });
  }

  async create(
    idCourse: number,
    idUser: number,
    dto: ActivityCreateDto,
    imported?: { manager: EntityManager; enrollmentId: number },
  ) {
    const enrollments = imported?.manager.getRepository(Enrollment) ?? this.enrollmentRepository;
    const details =
      imported?.manager.getRepository(GradeSchemeDetail) ?? this.gradeSchemeDetailRepository;
    const enrollment = await enrollments.findOne({
      where: {
        user: {
          idUser,
        },
        course: {
          idCourse,
        },
        role: CourseRelations.ASSISTANT,
        isActive: true,
        ...(imported ? { idEnrollment: imported.enrollmentId } : {}),
      },
      relations: {
        course: true,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('No eres auxiliar de esta materia');
    }

    const detail = await details.findOne({
      where: {
        idGradeSchemeDetail: dto.gradeSchemeDetailId,
        gradeScheme: {
          assistantEnrollment: {
            idEnrollment: enrollment.idEnrollment,
          },
        },
      },
    });

    if (!detail) {
      throw new BadRequestException(
        'El componente de calificación no pertenece a tu configuración como auxiliar',
      );
    }

    if (detail.isActive === false)
      throw new BadRequestException('El criterio está archivado y no admite nuevas actividades');

    const activity = this.activityRepository.create({
      gradeSchemeDetail: detail,
      name: dto.name,
      description: dto.description,
      publicationDate: dto.publicationDate ?? null,
      dueDate: dto.dueDate,
      createdBy: idUser,
    });

    return this.saveWithUniqueName(activity, idCourse, imported?.manager);
  }

  async getByGradeSchemeDetail(idGradeSchemeDetail: number): Promise<Activity[]> {
    return this.activityRepository.find({
      where: {
        gradeSchemeDetail: {
          idGradeSchemeDetail,
        },
        isActive: true,
      },
      relations: {
        gradeSchemeDetail: {
          gradeItem: true,
        },
      },
      order: ACTIVITY_ORDER,
    });
  }

  private async getActivityForAssistant(idActivity: number, idUser: number): Promise<Activity> {
    const activity = await this.activityRepository.findOne({
      where: {
        idActivity,
        isActive: true,
      },
      relations: {
        gradeSchemeDetail: {
          gradeScheme: {
            assistantEnrollment: {
              user: true,
              course: true,
            },
          },
          gradeItem: true,
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Actividad no encontrada o inactiva');
    }

    const assistantEnrollment = activity.gradeSchemeDetail.gradeScheme.assistantEnrollment;

    if (!assistantEnrollment) {
      throw new ForbiddenException('Esta actividad no pertenece a una configuración de auxiliar');
    }

    if (assistantEnrollment.user.idUser !== idUser) {
      throw new ForbiddenException('No tienes permisos para gestionar esta actividad');
    }

    if (!assistantEnrollment.isActive) {
      throw new ForbiddenException('La matrícula del auxiliar no está activa');
    }

    return activity;
  }

  async update(idActivity: number, idUser: number, dto: ActivityUpdateDto): Promise<Activity> {
    const activity = await this.getActivityForAssistant(idActivity, idUser);
    if (activity.gradeSchemeDetail.isActive === false)
      throw new BadRequestException('El criterio está archivado y sus actividades son históricas');

    if (dto.name !== undefined) {
      activity.name = dto.name;
    }

    if (dto.description !== undefined) {
      activity.description = dto.description;
    }

    if (dto.publicationDate !== undefined) {
      activity.publicationDate = dto.publicationDate;
    }

    if (dto.dueDate !== undefined) {
      activity.dueDate = dto.dueDate;
    }

    activity.updatedBy = idUser;

    return this.saveWithUniqueName(
      activity,
      activity.gradeSchemeDetail.gradeScheme.assistantEnrollment!.course.idCourse,
    );
  }

  async delete(idActivity: number, idUser: number) {
    const activity = await this.getActivityForAssistant(idActivity, idUser);

    activity.isActive = false;
    activity.deletedBy = idUser;

    return this.activityRepository.save(activity);
  }

  async reactivate(idActivity: number, idUser: number): Promise<Activity> {
    const activity = await this.activityRepository.findOne({
      where: {
        idActivity,
        isActive: false,
      },
      relations: {
        gradeSchemeDetail: {
          gradeScheme: {
            assistantEnrollment: {
              user: true,
              course: true,
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Actividad no encontrada o ya está activa');
    }

    const assistantEnrollment = activity.gradeSchemeDetail.gradeScheme.assistantEnrollment;

    if (!assistantEnrollment) {
      throw new ForbiddenException('Esta actividad no pertenece a una configuración de auxiliar');
    }

    if (assistantEnrollment.user.idUser !== idUser) {
      throw new ForbiddenException('No tienes permisos para gestionar esta actividad');
    }

    if (!assistantEnrollment.isActive) {
      throw new ForbiddenException('La matrícula del auxiliar no está activa');
    }

    if (activity.gradeSchemeDetail.isActive === false)
      throw new BadRequestException('El criterio está archivado y no admite reactivar actividades');

    activity.isActive = true;
    activity.deletedBy = 0;
    activity.updatedBy = idUser;

    return this.saveWithUniqueName(activity, assistantEnrollment.course.idCourse);
  }
}
