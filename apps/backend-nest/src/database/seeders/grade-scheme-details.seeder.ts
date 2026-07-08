import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';
import { gradeSchemeDetailsData } from '../data/grade-scheme-details.data';
import { GradeSchemeDetailSeed } from '../interfaces/grade-scheme-details.interface';
import { NotFoundException } from '@nestjs/common';

export class GradeSchemeDetailSeeder {
  constructor(
    private readonly repository: Repository<GradeSchemeDetail>,
    private readonly gradeSchemeRepository: Repository<GradeScheme>,
    private readonly gradeItemRepository: Repository<GradeItem>,
  ) {}

  async run() {
    for (const item of gradeSchemeDetailsData) {
      await this.create(item);
    }
  }

  async create(data: GradeSchemeDetailSeed) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: {
        name: data.gradeScheme,
      },
    });

    if (!gradeScheme) throw new NotFoundException(`Grade scheme ${data.gradeScheme} not found`);

    const gradeItem = await this.gradeItemRepository.findOne({
      where: {
        name: data.gradeItem,
      },
    });

    if (!gradeItem) throw new NotFoundException(`Grade item ${data.gradeItem} not found`);

    const exists = await this.repository.findOne({
      where: {
        gradeScheme: {
          idGradeScheme: gradeScheme.idGradeScheme,
        },
        gradeItem: {
          idGradeItem: gradeItem.idGradeItem,
        },
      },
    });

    if (exists) {
      console.log(`Relation already exists`);
      return;
    }

    const gradeSchemeDetails = this.repository.create({
      gradeScheme,
      gradeItem,
      percentage: data.percentage,
      order: data.order,
    });

    await this.repository.save(gradeSchemeDetails);
  }
}
