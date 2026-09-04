import { CourseRelations } from '@common/enums/courseRelations';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentCreateDto } from 'src/dtos/enrollments/enrollments.dto';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { In, Repository } from 'typeorm';
import { SemestersService } from '../semesters/semesters.service';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { SemesterNumber } from '@common/enums/semesterNumber';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly usersService: UsersService,
    private readonly semestersService: SemestersService,
    private readonly coursesService: CoursesService,
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
    dto.semester = dto.semester.toUpperCase();
    dto.courseCode = dto.courseCode.toUpperCase();

    const user = await this.usersService.getOneByUsername(dto.username);
    if (!user) throw new NotFoundException('Estudiante no encontrado o inactivo');

    const separatorIdx = dto.semester.indexOf('-');
    const period: SemesterNumber =
      dto.semester.substring(0, separatorIdx) === 'I' ? SemesterNumber.I : SemesterNumber.II;
    const year: number = Number(dto.semester.substring(separatorIdx + 1, dto.semester.length));
    const semester = await this.semestersService.getOneByPeriodYear(period, year);
    if (!semester) throw new NotFoundException('Semestre no encontrado o inactivo');

    const course = await this.coursesService.getOneByCode(dto.courseCode);
    if (!course) throw new NotFoundException('Materia no encontrada o inactivo');

    const hasRequiredRole = user.roles.some((role) => (role.name as CourseRelations) === dto.role);
    if (!hasRequiredRole)
      throw new BadRequestException(
        `El usuario ${dto.username} no tiene el rol necesario (${dto.role}) para esta inscripción`,
      );

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { user, semester, course },
    });
    if (existingEnrollment)
      throw new ConflictException(
        'El estudiante ya está matriculado en esta materia durante este semestre',
      );

    const enrollment = this.enrollmentRepository.create({
      user,
      semester,
      course,
      role: dto.role,
    });

    return this.enrollmentRepository.save(enrollment);
  }

  async getUserEnrollments(idUser: number) {
    const user = await this.usersService.getOneById(idUser);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const enrollments = await this.enrollmentRepository.find({
      where: [
        {
          user: {
            idUser: user.idUser,
          },
          role: CourseRelations.STUDENT,
        },
        {
          user: {
            idUser: user.idUser,
          },
          role: CourseRelations.ASSISTANT,
        },
      ],
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
            },
          },
        },
      },
      order: {
        course: {
          code: 'ASC',
        },
      },
    });

    return enrollments;
  }

  async getMyEnrollment(idUser: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        user: {
          idUser,
        },
        role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
      },
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('La matrícula no existe o no pertenece al usuario');
    }

    return enrollment;
  }

  async getManagedEnrollment(idAssistant: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        role: CourseRelations.STUDENT,
      },
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('La matrícula del estudiante no existe');
    }

    const assistantEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: {
          idUser: idAssistant,
        },
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        role: CourseRelations.ASSISTANT,
      },
    });

    if (!assistantEnrollment) {
      throw new ForbiddenException('No tienes permisos para gestionar esta matrícula');
    }

    return enrollment;
  }

  async getStudentsByEnrollment(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
      },
      relations: {
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación no encontrada');
    }

    const students = await this.enrollmentRepository.find({
      where: {
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        role: CourseRelations.STUDENT,
      },
      relations: {
        user: true,
      },
      order: {
        user: {
          lastname: 'ASC',
          name: 'ASC',
        },
      },
    });

    return students;
  }
}
