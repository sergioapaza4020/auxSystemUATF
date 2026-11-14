import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';
import { gradeSchemeDetailsData } from '../data/grade-scheme-details.data';
import { GradeSchemeDetailSeed } from '../interfaces/grade-scheme-details.interface';
import { findSeedRecord, requireSeedReference, SeedDataError } from '../utils/seed-integrity';

export class GradeSchemeDetailSeeder {
  constructor(
    private readonly repository: Repository<GradeSchemeDetail>,
    private readonly gradeSchemeRepository: Repository<GradeScheme>,
    private readonly gradeItemRepository: Repository<GradeItem>,
  ) {}

  async run() {
    const names = [...new Set(gradeSchemeDetailsData.map((item) => item.gradeScheme))];
    for (const name of names) {
      const scheme = await findSeedRecord(this.gradeSchemeRepository, { name }, 'Esquema general');
      if (!scheme) throw new SeedDataError('Esquema general: falta el registro padre.');
      if (!scheme.isActive || scheme.deletedAt) continue;
      // Existing distributions may have been edited by users. Never refill omitted
      // criteria. A new distribution is written atomically by the runner's unit.
      if (await this.repository.countBy({ gradeScheme: { idGradeScheme: scheme.idGradeScheme } }))
        continue;
      for (const item of gradeSchemeDetailsData.filter((detail) => detail.gradeScheme === name)) {
        await this.create(item);
      }
    }
  }

  async create(data: GradeSchemeDetailSeed) {
    const gradeScheme = await requireSeedReference(
      this.gradeSchemeRepository,
      { name: data.gradeScheme },
      'Esquema general',
    );
    const gradeItem = await requireSeedReference(
      this.gradeItemRepository,
      { name: data.gradeItem },
      'Criterio',
    );

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
