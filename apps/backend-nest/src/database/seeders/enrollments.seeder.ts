import { Repository } from 'typeorm';
import { enrollmentsData } from '../data/enrollments.data';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { User } from 'src/entities/users/users.entity';
import { EnrollmentSeed } from '../interfaces/enrollments.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SemesterNumber } from '@common/enums/semesterNumber';
import { CourseRelations } from '@common/enums/courseRelations';

export class EnrollmentSeeder {
  constructor(
    private readonly repository: Repository<Enrollment>,
    private readonly userRepository: Repository<User>,
    private readonly courseRepository: Repository<Course>,
    private readonly SemesterRepository: Repository<Semester>,
  ) {}

  async run() {
    for (const item of enrollmentsData) {
      await this.create(item);
    }
  }

  async create(data: EnrollmentSeed) {
    const user = await this.userRepository.findOne({
      where: { username: data.user },
      relations: { roles: true },
    });
    if (!user) throw new NotFoundException(`User ${data.user} cannot be found`);

    const separatorIdx = data.semester.indexOf('-');
    const period: SemesterNumber =
      data.semester.substring(0, separatorIdx) === 'I' ? SemesterNumber.I : SemesterNumber.II;
    const year: number = Number(data.semester.substring(separatorIdx + 1, data.semester.length));
    const semester = await this.SemesterRepository.findOne({
      where: { period: period, year: year },
    });
    if (!semester) throw new NotFoundException(`Semester ${period}-${year} cannot be found`);

    const course = await this.courseRepository.findOne({
      where: { code: data.courseCode },
    });
    if (!course) throw new NotFoundException(`Course ${data.courseCode} cannot be found`);

    const hasRequiredRole = user.roles.some((r) => (r.name as CourseRelations) === data.role);
    if (!hasRequiredRole)
      throw new BadRequestException(`User ${user.username} doesn't have the ${data.role} role`);

    const exists = await this.repository.findOne({
      where: { user: user, semester: semester, course: course },
    });
    if (exists)
      throw new BadRequestException(
        `User ${user.username} is already enroll in ${course.code} at ${data.semester} period`,
      );

    const enrollment = this.repository.create({
      semester,
      course,
      user,
      role: data.role,
    });

    await this.repository.save(enrollment);
  }
}
