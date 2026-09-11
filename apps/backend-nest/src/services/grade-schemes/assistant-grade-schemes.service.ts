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

  async getMyScheme(idAssistant: number, idCourse: number) {
    const enrollment = await this.getAssistantEnrollment(idAssistant, idCourse);

    const scheme = await this.gradeSchemeRepository.findOne({
      where: {
        assistantEnrollment: {
          idEnrollment: enrollment.idEnrollment,
        },
        isActive: true,
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

  async create(idAssistant: number, idCourse: number, dto: AssistantGradeSchemeCreateDto) {
    const enrollment = await this.getAssistantEnrollment(idAssistant, idCourse);

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

      scheme.name = dto.name ?? 'Configuración del auxiliar';
      scheme.description = dto.description as string;
      scheme.assistantPercentage = dto.assistantPercentage;

      await gradeSchemeRepository.save(scheme);

      await detailRepository.delete({
        gradeScheme: {
          idGradeScheme: scheme.idGradeScheme,
        },
      });

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

  private async getAssistantEnrollment(idAssistant: number, idCourse: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        user: {
          idUser: idAssistant,
        },
        course: {
          idCourse,
        },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      },
      relations: {
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('No eres auxiliar de esta materia');
    }

    return enrollment;
  }

  private validatePercentages(dto: AssistantGradeSchemeCreateDto | AssistantGradeSchemeUpdateDto) {
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
}
