import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { gradeItemsData } from '../data/grade-items.data';
import { BaseSeeder } from './base.seeder';

export class GradeItemSeeder extends BaseSeeder<GradeItem> {
  protected data(): DeepPartial<GradeItem>[] {
    return gradeItemsData;
  }

  protected where(item: DeepPartial<GradeItem>): FindOptionsWhere<GradeItem> {
    return {
      name: item.name,
    };
  }
}
