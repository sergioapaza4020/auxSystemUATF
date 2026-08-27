import { Semester } from 'src/entities/semesters/semester.entity';
import { DeepPartial } from 'typeorm';
import { BaseSeeder } from './base.seeder';
import { semestersData } from '../data/semesters.data';

export class SemesterSeeder extends BaseSeeder<Semester> {
  protected data(): DeepPartial<Semester[]> {
    return semestersData;
  }

  protected where(item: DeepPartial<Semester>) {
    return {
      period: item.period,
      year: item.year,
    };
  }
}
