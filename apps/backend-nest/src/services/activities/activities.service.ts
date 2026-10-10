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
import { Repository } from 'typeorm';
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

  private async saveWithUniqueName(activity: Activity, idCourse: number): Promise<Activity> {
    activity.name = activity.name.trim();
    if (!activity.name)
      throw new BadRequestException('El nombre de la actividad no puede estar vacío');

    return this.activityRepository.manager.transaction(async (manager) => {
      // Serialize activity writes within the course; its identity is reached through relations,
      // so a simple unique index on activities cannot enforce course-wide uniqueness.
      await manager.getRepository(Course).findOneOrFail({
        where: { idCourse },
        lock: { mode: 'pessimistic_write' },
      });
      const repository = manager.getRepository(Activity);
      const query = repository
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
        .andWhere('activity.deletedAt IS NULL')
        .andWhere('LOWER(BTRIM(activity.name)) = LOWER(BTRIM(:name))', { name: activity.name });
      if (activity.idActivity !== undefined) {
        query.andWhere('activity.idActivity != :idActivity', { idActivity: activity.idActivity });
      }
      if (await query.getExists()) {
        throw new ConflictException('Ya existe una actividad con ese nombre en esta materia.');
      }
      return repository.save(activity);
    });
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

  async create(idCourse: number, idUser: number, dto: ActivityCreateDto) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        user: {
          idUser,
        },
        course: {
          idCourse,
        },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      },
      relations: {
        course: true,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('No eres auxiliar de esta materia');
    }

    const detail = await this.gradeSchemeDetailRepository.findOne({
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

    const activity = this.activityRepository.create({
      gradeSchemeDetail: detail,
      name: dto.name,
      description: dto.description,
      publicationDate: dto.publicationDate ?? null,
      dueDate: dto.dueDate,
      createdBy: idUser,
    });

    return this.saveWithUniqueName(activity, idCourse);
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

    activity.isActive = true;
    activity.deletedBy = 0;
    activity.updatedBy = idUser;

    return this.saveWithUniqueName(activity, assistantEnrollment.course.idCourse);
  }
}
