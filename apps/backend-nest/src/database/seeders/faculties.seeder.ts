import { DeepPartial } from 'typeorm';

import { BaseSeeder } from './base.seeder';

import { facultiesData } from '../data/faculties.data';
import { Faculty } from 'src/entities/faculties/faculties.entity';

export class FacultySeeder extends BaseSeeder<Faculty> {
  protected data(): DeepPartial<Faculty[]> {
    return facultiesData;
  }

  protected where(item: DeepPartial<Faculty>) {
    return {
      name: item.name,
    };
  }
}
