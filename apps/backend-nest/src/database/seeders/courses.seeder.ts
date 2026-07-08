import { Career } from 'src/entities/careers/careers.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';
import { CourseSeed } from '../interfaces/courses.interface';
import { coursesData } from '../data/courses.data';

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
    const career = await this.careerRepository.findOne({
      where: {
        name: data.career,
      },
    });

    if (!career) throw new Error(`Career ${data.career} not found`);

    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: {
        name: data.gradeScheme,
      },
    });

    if (!gradeScheme) throw new Error(`Grade scheme ${data.gradeScheme} not found`);

    const exists = await this.repository.findOne({
      where: {
        code: data.code,
      },
    });

    if (exists) {
      console.log(`Course ${data.name} already exists`);
      return;
    }

    const course = this.repository.create({
      code: data.code,
      name: data.name,
      group: data.group,
      gradeScheme: gradeScheme,
      career: career,
    });

    await this.repository.save(course);
  }
}
