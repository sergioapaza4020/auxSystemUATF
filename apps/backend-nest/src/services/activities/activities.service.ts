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
      order: {
        order: 'ASC',
      },
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

    const existingActivity = await this.activityRepository.findOne({
      where: {
        gradeSchemeDetail: {
          idGradeSchemeDetail: dto.gradeSchemeDetailId,
        },
        order: dto.order,
        isActive: true,
      },
    });

    if (existingActivity) {
      throw new ConflictException('Ya existe una actividad con ese orden');
    }

    const activity = this.activityRepository.create({
      gradeSchemeDetail: detail,
      name: dto.name,
      description: dto.description,
      date: dto.date as unknown as Date,
      order: dto.order,
      createdBy: idUser,
    });

    return this.activityRepository.save(activity);
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
      order: {
        order: 'ASC',
      },
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

    if (dto.date !== undefined) {
      activity.date = dto.date as unknown as Date;
    }

    if (dto.order !== undefined) {
      const existingActivity = await this.activityRepository.findOne({
        where: {
          gradeSchemeDetail: {
            idGradeSchemeDetail: activity.gradeSchemeDetail.idGradeSchemeDetail,
          },
          order: dto.order,
          isActive: true,
        },
      });

      if (existingActivity && existingActivity.idActivity !== idActivity) {
        throw new ConflictException('Ya existe una actividad con ese orden');
      }

      activity.order = dto.order;
    }

    activity.updatedBy = idUser;

    return this.activityRepository.save(activity);
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

    const existingActivity = await this.activityRepository.findOne({
      where: {
        gradeSchemeDetail: {
          idGradeSchemeDetail: activity.gradeSchemeDetail.idGradeSchemeDetail,
        },
        order: activity.order,
        isActive: true,
      },
    });

    if (existingActivity) {
      throw new ConflictException('Ya existe una actividad activa con ese orden');
    }

    activity.isActive = true;
    activity.deletedBy = 0;
    activity.updatedBy = idUser;

    return this.activityRepository.save(activity);
  }
}
