import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeSchemeUpdateDto } from 'src/dtos/grade-schemes/grade-scheme-update.dto';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class GradeSchemesService {
  constructor(
    @InjectRepository(GradeScheme) private readonly gradeSchemeRepository: Repository<GradeScheme>,
    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,
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
    console.log('entro a la funcion al menos');
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { name: gradeSchemeCreateDto.name },
    });

    if (gradeScheme) throw new BadRequestException('Grade scheme already exists');

    console.log('traté de encontrar a gradescheme que no existe, en efecto, no existe');
    const newGradeScheme: GradeSchemeCreateDto = {
      name: '',
      description: '',
      details: [],
    };

    const totalPercentage = gradeSchemeCreateDto.details.reduce(
      (sum, detail) => sum + detail.percentage,
      0,
    );

    if (totalPercentage !== 100)
      throw new BadRequestException(
        'The total percentage of the grade scheme must be exactly 100%.',
      );

    newGradeScheme.name = gradeSchemeCreateDto.name;
    newGradeScheme.description = gradeSchemeCreateDto.description;

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
    console.log(newGradeScheme);

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

      gradeScheme.name = gradeSchemeUpdateDto.name;
      gradeScheme.description = gradeSchemeUpdateDto.description;

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
