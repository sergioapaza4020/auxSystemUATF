import { Grade } from 'src/entities/grades/grades.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { statusFilter } from '@common/utils/status-filter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { CourseRelations } from '@common/enums/courseRelations';

import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

import {
  AssistantGradeSchemeCreateDto,
  AssistantGradeSchemeUpdateDto,
} from 'src/dtos/assistant-grade-schemes/assistant-grade-scheme.dto';

@Injectable()
export class AssistantGradeSchemesService {
  constructor(
    @InjectRepository(GradeScheme)
    private readonly gradeSchemeRepository: Repository<GradeScheme>,
    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly dataSource: DataSource,
  ) {}

  async getMyScheme(
    idAssistant: number,
    idCourse: number,
    idEnrollment?: number,
    status = RecordStatus.ACTIVE,
  ) {
    const enrollment = await this.getAssistantEnrollment(idAssistant, idCourse, idEnrollment);

    const scheme = await this.gradeSchemeRepository.findOne({
      where: {
        assistantEnrollment: {
          idEnrollment: enrollment.idEnrollment,
        },
        ...statusFilter(status),
      },
      relations: {
        details: {
          gradeItem: true,
          activities: true,
        },
      },
    });

    return scheme;
  }

  async create(
    idAssistant: number,
    idCourse: number,
    dto: AssistantGradeSchemeCreateDto,
    idEnrollment?: number,
  ) {
    const enrollment = await this.getAssistantEnrollment(idAssistant, idCourse, idEnrollment);

    const existingScheme = await this.gradeSchemeRepository.findOne({
      where: {
        assistantEnrollment: {
          idEnrollment: enrollment.idEnrollment,
        },
      },
    });

    if (existingScheme) {
      throw new ConflictException('Este auxiliar ya tiene una configuración para esta materia');
    }

    this.validatePercentages(dto);

    return this.dataSource.transaction(async (manager) => {
      const gradeSchemeRepository = manager.getRepository(GradeScheme);
      const detailRepository = manager.getRepository(GradeSchemeDetail);

      const scheme = gradeSchemeRepository.create({
        name: dto.name ?? 'Configuración del auxiliar',
        description: dto.description ?? undefined,
        assistantPercentage: dto.assistantPercentage,
        assistantEnrollment: enrollment,
      });

      await gradeSchemeRepository.save(scheme);

      const details = dto.details.map((detail, index) =>
        detailRepository.create({
          gradeScheme: scheme,
          gradeItem: {
            idGradeItem: detail.gradeItem.idGradeItem,
          },
          percentage: detail.percentage,
          order: index + 1,
        }),
      );

      await detailRepository.save(details);

      return gradeSchemeRepository.findOne({
        where: {
          idGradeScheme: scheme.idGradeScheme,
        },
        relations: {
          details: {
            gradeItem: true,
            activities: true,
          },
        },
      });
    });
  }

  async update(
    idAssistant: number,
    idAssistantGradeScheme: number,
    dto: AssistantGradeSchemeUpdateDto,
  ) {
    this.validatePercentages(dto);

    const scheme = await this.gradeSchemeRepository.findOne({
      where: {
        idGradeScheme: idAssistantGradeScheme,
        assistantEnrollment: {
          isActive: true,
          role: CourseRelations.ASSISTANT,
          user: {
            idUser: idAssistant,
          },
        },
        isActive: true,
      },
      relations: {
        assistantEnrollment: true,
      },
    });

    if (!scheme) {
      throw new NotFoundException('Configuración del auxiliar no encontrada');
    }

    return this.dataSource.transaction(async (manager) => {
      const gradeSchemeRepository = manager.getRepository(GradeScheme);
      const detailRepository = manager.getRepository(GradeSchemeDetail);

      const locked = await gradeSchemeRepository.findOne({
        where: { idGradeScheme: scheme.idGradeScheme, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Configuraci�n del auxiliar no encontrada');
      const existing = await detailRepository
        .createQueryBuilder('detail')
        .leftJoinAndSelect('detail.gradeItem', 'item')
        .where('detail.id_grade_scheme = :id', { id: scheme.idGradeScheme })
        .setLock('pessimistic_write', undefined, ['detail'])
        .getMany();
      if (
        new Set(existing.map((detail) => detail.gradeItem.idGradeItem)).size !== existing.length
      ) {
        throw new ConflictException(
          'El esquema contiene �tems duplicados; requiere revisi�n antes de editarlo',
        );
      }
      const kept = new Set(dto.details.map((detail) => detail.gradeItem.idGradeItem));
      const removed = existing.filter((detail) => !kept.has(detail.gradeItem.idGradeItem));
      for (const detail of removed) {
        const where = { gradeSchemeDetail: { idGradeSchemeDetail: detail.idGradeSchemeDetail } };
        const activityCount = await manager.getRepository(Activity).countBy(where);
        const gradeCount = await manager.getRepository(Grade).countBy(where);
        if (activityCount || gradeCount) {
          throw new ConflictException(
            `No se puede quitar �${detail.gradeItem.name}�: tiene actividades o notas. Cons�rvalo en el esquema.`,
          );
        }
      }
      const details: GradeSchemeDetail[] = [];
      for (const [index, input] of dto.details.entries()) {
        let detail = existing.find(
          (item) => item.gradeItem.idGradeItem === input.gradeItem.idGradeItem,
        );
        if (!detail) {
          const item = await manager
            .getRepository(GradeItem)
            .findOne({ where: { idGradeItem: input.gradeItem.idGradeItem, isActive: true } });
          if (!item) throw new BadRequestException('�tem de calificaci�n inexistente o inactivo');
          detail = detailRepository.create({ gradeScheme: scheme, gradeItem: item });
        }
        detail.percentage = input.percentage;
        detail.order = index + 1;
        details.push(detail);
      }
      locked.name = dto.name ?? locked.name;
      locked.description = dto.description ?? locked.description;
      locked.assistantPercentage = dto.assistantPercentage;
      await gradeSchemeRepository.save(locked);
      for (const detail of removed) await detailRepository.delete(detail.idGradeSchemeDetail);
      await detailRepository.save(details);

      return gradeSchemeRepository.findOne({
        where: {
          idGradeScheme: scheme.idGradeScheme,
        },
        relations: {
          details: {
            gradeItem: true,
            activities: true,
          },
        },
      });
    });
  }

  private async getAssistantEnrollment(
    idAssistant: number,
    idCourse: number,
    idEnrollment?: number,
  ) {
    const matches = await this.enrollmentRepository.find({
      where: {
        ...(idEnrollment === undefined ? {} : { idEnrollment }),
        user: { idUser: idAssistant },
        course: { idCourse },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      },
      relations: { course: true, semester: true },
    });
    if (!matches.length) throw new ForbiddenException('No eres auxiliar de esta materia');
    if (matches.length > 1)
      throw new ConflictException('Selecciona la matr�cula y el semestre del auxiliar');
    return matches[0];
  }

  private validatePercentages(dto: AssistantGradeSchemeCreateDto | AssistantGradeSchemeUpdateDto) {
    if (
      new Set(dto.details.map((detail) => detail.gradeItem.idGradeItem)).size !== dto.details.length
    ) {
      throw new BadRequestException('No se puede repetir un �tem en el esquema');
    }
    const totalPercentage = dto.details.reduce((sum, detail) => sum + detail.percentage, 0);

    if (totalPercentage !== 100) {
      throw new BadRequestException(
        'El porcentaje de los elementos del auxiliar debe sumar exactamente 100%.',
      );
    }

    if (dto.assistantPercentage > 100) {
      throw new BadRequestException('El porcentaje del auxiliar no puede superar el 100%.');
    }
  }

  private async setActive(idAssistant: number, idGradeScheme: number, isActive: boolean) {
    const scheme = await this.gradeSchemeRepository.findOne({
      where: {
        idGradeScheme,
        isActive: !isActive,
        assistantEnrollment: {
          user: { idUser: idAssistant },
          role: CourseRelations.ASSISTANT,
          isActive: true,
        },
      },
    });
    if (!scheme) throw new NotFoundException('Configuración del auxiliar no encontrada');
    scheme.isActive = isActive;
    return this.gradeSchemeRepository.save(scheme);
  }

  async delete(idAssistant: number, idGradeScheme: number) {
    return this.setActive(idAssistant, idGradeScheme, false);
  }

  async reactivate(idAssistant: number, idGradeScheme: number) {
    return this.setActive(idAssistant, idGradeScheme, true);
  }
}
