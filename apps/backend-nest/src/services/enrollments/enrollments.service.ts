import { Grade } from 'src/entities/grades/grades.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { EnrollmentUpdateDto } from 'src/dtos/enrollments/enrollments-update.dto';
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

  private async resolveEnrollment(dto: EnrollmentCreateDto) {
    dto.semester = dto.semester.toUpperCase();
    if (!/^(I|II)-\d{4}$/.test(dto.semester))
      throw new BadRequestException('Formato de semestre inválido');
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

    return { user, semester, course, role: dto.role };
  }

  async create(dto: EnrollmentCreateDto) {
    const data = await this.resolveEnrollment({ ...dto });
    const existing = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: data.user.idUser },
        semester: { idSemester: data.semester.idSemester },
        course: { idCourse: data.course.idCourse },
      },
    });
    if (existing)
      throw new ConflictException(
        'El usuario ya está matriculado en esta materia durante este semestre',
      );
    return this.enrollmentRepository.save(this.enrollmentRepository.create(data));
  }

  async getOneById(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { idEnrollment, isActive: true },
      relations: { user: true, semester: true, course: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  async update(idEnrollment: number, dto: EnrollmentUpdateDto) {
    const enrollment = await this.getOneById(idEnrollment);
    const data = await this.resolveEnrollment({
      username: dto.username ?? enrollment.user.username,
      semester:
        dto.semester ??
        `${enrollment.semester.period === SemesterNumber.I ? 'I' : 'II'}-${enrollment.semester.year}`,
      courseCode: dto.courseCode ?? enrollment.course.code,
      role: dto.role ?? enrollment.role,
    });
    const duplicate = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: data.user.idUser },
        semester: { idSemester: data.semester.idSemester },
        course: { idCourse: data.course.idCourse },
      },
    });
    if (duplicate && duplicate.idEnrollment !== idEnrollment)
      throw new ConflictException('La matrícula ya existe');
    const changesIdentity =
      enrollment.user.idUser !== data.user.idUser ||
      enrollment.course.idCourse !== data.course.idCourse ||
      enrollment.semester.idSemester !== data.semester.idSemester ||
      enrollment.role !== data.role;
    if (changesIdentity) {
      const manager = this.enrollmentRepository.manager;
      const records = await Promise.all([
        manager.getRepository(Grade).countBy({ enrollment: { idEnrollment } }),
        manager.getRepository(Attendance).countBy({ enrollment: { idEnrollment } }),
        manager.getRepository(AttendanceSession).countBy({ assistantEnrollment: { idEnrollment } }),
        manager.getRepository(GradeScheme).countBy({ assistantEnrollment: { idEnrollment } }),
      ]);
      if (records.some((count) => count > 0)) {
        throw new ConflictException(
          'No se puede reasignar una matrícula con notas, asistencias o configuraciones registradas',
        );
      }
    }
    this.enrollmentRepository.merge(enrollment, data);
    return this.enrollmentRepository.save(enrollment);
  }

  async delete(idEnrollment: number) {
    const enrollment = await this.getOneById(idEnrollment);
    enrollment.isActive = false;
    return this.enrollmentRepository.save(enrollment);
  }

  async reactivate(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { idEnrollment, isActive: false },
      relations: { user: true, semester: true, course: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula inactiva no encontrada');
    await this.resolveEnrollment({
      username: enrollment.user.username,
      semester: `${enrollment.semester.period === SemesterNumber.I ? 'I' : 'II'}-${enrollment.semester.year}`,
      courseCode: enrollment.course.code,
      role: enrollment.role,
    });
    enrollment.isActive = true;
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
          isActive: true,
          role: CourseRelations.STUDENT,
        },
        {
          user: {
            idUser: user.idUser,
          },
          isActive: true,
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
              activities: true,
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
        isActive: true,
        role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
      },
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
              activities: true,
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
    const enrollment = await this.verifyAssistantAccess(idAssistant, idEnrollment);

    const fullEnrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: enrollment.idEnrollment,
        isActive: true,
      },
      relations: {
        user: true,
        semester: true,
        course: {
          gradeScheme: {
            details: {
              gradeItem: true,
              activities: true,
            },
          },
        },
      },
    });

    if (!fullEnrollment) {
      throw new NotFoundException('La matrícula del estudiante no existe');
    }

    return fullEnrollment;
  }

  async getStudentsByEnrollment(idAssistant: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
      relations: {
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación de auxiliar no encontrada');
    }

    const assistantEnrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: enrollment.idEnrollment,
        user: { idUser: idAssistant },
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
    });

    if (!assistantEnrollment) {
      throw new ForbiddenException('No tienes permisos para gestionar esta materia');
    }

    const students = await this.enrollmentRepository.find({
      where: {
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        isActive: true,
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

  private async verifyAssistantAccess(idAssistant: number, idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
        isActive: true,
        role: CourseRelations.STUDENT,
      },
      relations: {
        course: true,
        semester: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación del estudiante no encontrada');
    }

    const assistantEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: { idUser: idAssistant },
        course: {
          idCourse: enrollment.course.idCourse,
        },
        semester: {
          idSemester: enrollment.semester.idSemester,
        },
        isActive: true,
        role: CourseRelations.ASSISTANT,
      },
    });

    if (!assistantEnrollment) {
      throw new ForbiddenException('No tienes permisos para gestionar esta matrícula');
    }

    return enrollment;
  }
}
