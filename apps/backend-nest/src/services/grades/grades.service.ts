import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: dto.enrollmentId,
      },
      relations: {
        course: {
          gradeScheme: true,
        },
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
          },
        },
        gradeItem: true,
      },
    });

    if (!detail) {
      throw new NotFoundException('Detalle del esquema de notas no encontrado');
    }

    const assistantEnrollment = detail.gradeScheme.assistantEnrollment;

    if (assistantEnrollment) {
      if (assistantEnrollment.user.idUser !== idUser) {
        throw new ForbiddenException(
          'No tienes permisos para registrar notas en esta configuración de auxiliar',
        );
      }

      if (!assistantEnrollment.isActive) {
        throw new ForbiddenException('La matrícula del auxiliar no está activa');
      }

      if (assistantEnrollment.course.idCourse !== enrollment.course.idCourse) {
        throw new BadRequestException('La configuración del auxiliar no pertenece a esta materia');
      }
    } else {
      if (enrollment.course.gradeScheme?.idGradeScheme !== detail.gradeScheme.idGradeScheme) {
        throw new BadRequestException(
          'El componente de nota no pertenece al esquema de la materia',
        );
      }
    }

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

      if (!activity) {
        throw new NotFoundException('Actividad no encontrada o inactiva');
      }

      if (activity.gradeSchemeDetail.idGradeSchemeDetail !== detail.idGradeSchemeDetail) {
        throw new BadRequestException('La actividad no pertenece al componente de nota indicado');
      }

      if (
        activity.gradeSchemeDetail.gradeScheme.idGradeScheme !== detail.gradeScheme.idGradeScheme
      ) {
        throw new BadRequestException('La actividad no pertenece al esquema de la materia');
      }
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

    return this.gradeRepository.save(grade);
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
      await this.enrollmentsService.getManagedEnrollment(idUser, idEnrollment);
    }

    return this.gradeRepository.find({
      where: {
        enrollment: {
          idEnrollment,
        },
      },
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
        activity: {
          order: 'ASC',
        },
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
}
