import { Career } from 'src/entities/careers/careers.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';
import { CourseSeed } from '../interfaces/courses.interface';
import { coursesData } from '../data/courses.data';
import { findSeedRecord, requireSeedReference } from '../utils/seed-integrity';

export class CourseSeeder {
  constructor(
    private readonly repository: Repository<Course>,
    private readonly careerRepository: Repository<Career>,
    private readonly gradeSchemeRepository: Repository<GradeScheme>,
  ) {}

  async run() {
    for (const item of coursesData) {
      await this.create(item);
    }
  }

  async create(data: CourseSeed) {
    const exists = await findSeedRecord(
      this.repository,
      { code: data.code, group: data.group },
      'Materia/grupo',
    );
    if (exists) return exists;
    const career = await requireSeedReference(
      this.careerRepository,
      { name: data.career },
      'Carrera',
    );
    const gradeScheme = await requireSeedReference(
      this.gradeSchemeRepository,
      { name: data.gradeScheme },
      'Esquema general',
    );

    const course = this.repository.create({
      code: data.code,
      name: data.name,
      group: data.group,
      gradeScheme: gradeScheme,
      career: [career],
    });

    await this.repository.save(course);
  }
}
