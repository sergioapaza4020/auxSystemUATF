import { CourseRelations } from '@common/enums/courseRelations';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentCreateDto } from 'src/dtos/enrollments/enrollments.dto';
import { Course } from 'src/entities/courses/courses.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Semester) private readonly semesterRepository: Repository<Semester>,
    @InjectRepository(Course) private readonly courseRepository: Repository<Course>,
  ) {}

  async getAll(): Promise<Enrollment[]> {
    return this.enrollmentRepository.find({
      where: { isActive: true },
      relations: {
        semester: true,
        course: true,
        user: true,
      },
    });
  }

  async create(dto: EnrollmentCreateDto) {
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: dto.idUser },
        semester: { idSemester: dto.idSemester },
        course: { idCourse: dto.idCourse },
      },
    });
    if (existingEnrollment)
      throw new ConflictException(
        'El estudiante ya está matriculado en este curso durante este semestre',
      );

    const user = await this.userRepository.findOne({
      where: { idUser: dto.idUser, isActive: true },
      relations: { roles: true },
    });
    if (!user) throw new NotFoundException('Estudiante no encontrado o inactivo');

    const semester = await this.semesterRepository.findOne({
      where: { idSemester: dto.idSemester, isActive: true },
    });
    if (!semester) throw new NotFoundException('Semestre no encontrado o inactivo');

    const course = await this.courseRepository.findOne({
      where: { idCourse: dto.idCourse, isActive: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado o inactivo');

    const hasRequiredRole = user.roles.some((role) => (role.name as CourseRelations) === dto.role);
    if (!hasRequiredRole)
      throw new BadRequestException('El usuario no tiene el rol necesario para esta inscripción');

    const enrollment = this.enrollmentRepository.create({
      user,
      semester,
      course,
    });

    return this.enrollmentRepository.save(enrollment);
  }
}
