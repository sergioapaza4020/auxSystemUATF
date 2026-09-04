import { CourseRelations } from '@common/enums/courseRelations';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeSchemeUpdateDto } from 'src/dtos/grade-schemes/grade-scheme-update.dto';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { Course } from 'src/entities/courses/courses.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class GradeSchemesService {
  constructor(
    @InjectRepository(GradeScheme)
    private readonly gradeSchemeRepository: Repository<GradeScheme>,

    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,

    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,

    private readonly dataSource: DataSource,
  ) {}

  async getAll(): Promise<GradeScheme[]> {
    return this.gradeSchemeRepository.find({
      relations: {
        details: {
          gradeItem: true,
        },
      },
    });
  }

  async create(gradeSchemeCreateDto: GradeSchemeCreateDto) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { name: gradeSchemeCreateDto.name },
    });

    if (gradeScheme) throw new BadRequestException('Grade scheme already exists');

    const newGradeScheme = this.gradeSchemeRepository.create({
      name: gradeSchemeCreateDto.name,
      description: gradeSchemeCreateDto.description,
    });

    const totalPercentage = gradeSchemeCreateDto.details.reduce(
      (sum, detail) => sum + detail.percentage,
      0,
    );

    if (totalPercentage !== 100)
      throw new BadRequestException(
        'The total percentage of the grade scheme must be exactly 100%.',
      );

    newGradeScheme.name = gradeSchemeCreateDto.name ?? '';
    newGradeScheme.description = gradeSchemeCreateDto.description ?? '';

    await this.gradeSchemeRepository.save(newGradeScheme);

    const details = gradeSchemeCreateDto.details.map((detail, idx) =>
      this.gradeSchemeDetailRepository.create({
        gradeScheme: newGradeScheme,
        gradeItem: {
          idGradeItem: detail.gradeItem.idGradeItem,
        },
        percentage: detail.percentage,
        order: idx + 1,
      }),
    );

    await this.gradeSchemeDetailRepository.save(details);

    newGradeScheme.details = details;

    await this.gradeSchemeRepository.save(newGradeScheme);

    return newGradeScheme;
  }

  async getOneById(idGradeScheme: number) {
    return this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: true },
      relations: {
        details: {
          gradeItem: true,
        },
      },
    });
  }

  async getOneByName(name: string): Promise<GradeScheme | null> {
    return this.gradeSchemeRepository.findOne({
      where: { name, isActive: true },
      relations: {
        details: {
          gradeItem: true,
        },
      },
    });
  }

  async createForAssistant(idCourse: number, idUser: number, dto: GradeSchemeCreateDto) {
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
        course: {
          gradeScheme: true,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('No eres auxiliar de esta materia');
    }

    if (enrollment.course.gradeScheme) {
      throw new ConflictException('Esta materia ya tiene un esquema de notas');
    }

    const totalPercentage = dto.details.reduce((sum, detail) => sum + detail.percentage, 0);

    if (totalPercentage !== 100) {
      throw new BadRequestException('El porcentaje total del esquema debe ser exactamente 100%.');
    }

    return this.dataSource.transaction(async (manager) => {
      const gradeSchemeRepository = manager.getRepository(GradeScheme);

      const gradeSchemeDetailRepository = manager.getRepository(GradeSchemeDetail);

      const courseRepository = manager.getRepository(Course);

      const gradeScheme = gradeSchemeRepository.create({
        name: dto.name,
        description: dto.description,
      });

      await gradeSchemeRepository.save(gradeScheme);

      const details = dto.details.map((detail, index) =>
        gradeSchemeDetailRepository.create({
          gradeScheme,
          gradeItem: {
            idGradeItem: detail.gradeItem.idGradeItem,
          },
          percentage: detail.percentage,
          order: index + 1,
        }),
      );

      await gradeSchemeDetailRepository.save(details);

      enrollment.course.gradeScheme = gradeScheme;

      await courseRepository.save(enrollment.course);

      return gradeSchemeRepository.findOne({
        where: {
          idGradeScheme: gradeScheme.idGradeScheme,
        },
        relations: {
          details: {
            gradeItem: true,
          },
        },
      });
    });
  }

  async update(
    idGradeScheme: number,
    gradeSchemeUpdateDto: GradeSchemeUpdateDto,
  ): Promise<GradeScheme | null> {
    return await this.dataSource.transaction(async (manager) => {
      const gradeSchemeRepository = manager.getRepository(GradeScheme);
      const gradeSchemeDetailRepository = manager.getRepository(GradeSchemeDetail);

      const gradeScheme = await gradeSchemeRepository.findOne({
        where: { idGradeScheme, isActive: true },
      });

      if (!gradeScheme) throw new BadRequestException('Grade scheme not found');
      if (!gradeSchemeUpdateDto.details)
        throw new BadRequestException('Details from grade scheme not found');

      const totalPercentage = gradeSchemeUpdateDto.details.reduce(
        (sum, detail) => sum + detail.percentage,
        0,
      );

      if (totalPercentage !== 100)
        throw new BadRequestException(
          'The total percentage of the grade scheme must be exactly 100%.',
        );

      gradeScheme.name = gradeSchemeUpdateDto.name ?? '';
      gradeScheme.description = gradeSchemeUpdateDto.description ?? '';

      await gradeSchemeRepository.save(gradeScheme);

      await gradeSchemeDetailRepository.delete({
        gradeScheme: { idGradeScheme },
      });

      const details = gradeSchemeUpdateDto.details.map((detail, idx) =>
        gradeSchemeDetailRepository.create({
          gradeScheme,
          gradeItem: {
            idGradeItem: detail.gradeItem.idGradeItem,
          },
          percentage: detail.percentage,
          order: idx + 1,
        }),
      );

      await gradeSchemeDetailRepository.save(details);

      return await gradeSchemeRepository.findOne({
        where: { idGradeScheme },
        relations: {
          details: { gradeItem: true },
        },
      });
    });
  }

  async delete(idGradeScheme: number) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: true },
    });

    if (!gradeScheme) throw new BadRequestException('Grade scheme not found');
    gradeScheme.isActive = false;
    return this.gradeSchemeRepository.save(gradeScheme);
  }

  async reactivate(idGradeScheme: number) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: false },
    });

    if (!gradeScheme) throw new BadRequestException('Grade scheme not found');
    gradeScheme.isActive = true;
    return this.gradeSchemeRepository.save(gradeScheme);
  }
}
