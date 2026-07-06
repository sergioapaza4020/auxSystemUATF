import { DeepPartial } from 'typeorm';

import { BaseSeeder } from './base.seeder';

import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { gradeSchemesData } from '../data/grade-schemes.data';

export class GradeSchemeSeeder extends BaseSeeder<GradeScheme> {
  protected data(): DeepPartial<GradeScheme[]> {
    return gradeSchemesData;
  }

  protected where(item: DeepPartial<GradeScheme>) {
    return {
      name: item.name,
    };
  }
}
