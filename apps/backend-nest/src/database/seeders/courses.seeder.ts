import { Career } from 'src/entities/careers/careers.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';

export class CourseSeeder {
  constructor(
    private readonly repository: Repository<Course>,
    private readonly careerRepository: Repository<Career>,
    private readonly gradeSchemeRepository: Repository<GradeScheme>,
  ) {}

  async run() {
    const career = await this.careerRepository.findOneBy({
      name: 'ingenieria de sistemas',
    });

    if (!career) throw new Error('Career not found');

    const gradeScheme = await this.gradeSchemeRepository.findOneBy({
      name: 'esquema teórico 001',
    });

    if (!gradeScheme) throw new Error('Grade scheme not found');

    const exists = await this.repository.findOneBy({
      name: 'técnicas de programación I',
    });

    if (exists) return;

    await this.repository.save(
      this.repository.create({
        ...Course,
        name: 'técnicas de programación I',
        gradeScheme,
      }),
    );
  }
}
