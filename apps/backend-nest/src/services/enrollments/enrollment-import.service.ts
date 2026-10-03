import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CourseRelations } from '@common/enums/courseRelations';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { Course } from 'src/entities/courses/courses.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { User } from 'src/entities/users/users.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import {
  EnrollmentImportPreviewDto,
  EnrollmentImportResultDto,
  EnrollmentImportRowDto,
  EnrollmentImportTargetDto,
} from 'src/dtos/enrollments/enrollment-import.dto';
import {
  createEnrollmentImportTemplate,
  EnrollmentImportInputRow,
  parseEnrollmentImport,
} from './enrollment-import-excel';

const BATCH_SIZE = 500;

@Injectable()
export class EnrollmentImportService {
  constructor(@InjectRepository(Enrollment) private readonly repository: Repository<Enrollment>) {}

  async template(target: EnrollmentImportTargetDto, actor: JwtPayload): Promise<Buffer> {
    return this.handleErrors(async () => {
      await this.validateTarget(this.repository.manager, target, actor);
      return createEnrollmentImportTemplate();
    });
  }

  async preview(
    file: Express.Multer.File | undefined,
    target: EnrollmentImportTargetDto,
    actor: JwtPayload,
  ): Promise<EnrollmentImportPreviewDto> {
    return this.handleErrors(async () => {
      await this.validateTarget(this.repository.manager, target, actor);
      return this.validateRows(this.repository.manager, await parseEnrollmentImport(file), target);
    });
  }

  async import(
    file: Express.Multer.File | undefined,
    target: EnrollmentImportTargetDto,
    actor: JwtPayload,
  ): Promise<EnrollmentImportResultDto> {
    return this.handleErrors(async () => {
      const rows = await parseEnrollmentImport(file);
      // Revalidate all database state in the same transaction that performs every insert.
      return this.repository.manager.transaction('SERIALIZABLE', async (manager) => {
        await this.validateTarget(manager, target, actor);
        const preview = await this.validateRows(manager, rows, target);
        if (preview.invalid > 0)
          throw new BadRequestException(
            `El archivo contiene ${preview.invalid} filas inválidas. No se creó ninguna matrícula. Vuelve a revisar el archivo.`,
          );
        for (let offset = 0; offset < preview.rows.length; offset += BATCH_SIZE) {
          const values = preview.rows.slice(offset, offset + BATCH_SIZE).map((row) => {
            if (row.studentId === null) throw new BadRequestException('Estudiante no resuelto');
            return {
              user: { idUser: row.studentId },
              course: { idCourse: target.courseId },
              semester: { idSemester: target.semesterId },
              role: CourseRelations.STUDENT,
              createdBy: actor.idUser,
            };
          });
          await manager.getRepository(Enrollment).insert(values);
        }
        return {
          imported: preview.total,
          total: preview.total,
          courseId: target.courseId,
          semesterId: target.semesterId,
        };
      });
    });
  }

  private async validateTarget(
    manager: EntityManager,
    target: EnrollmentImportTargetDto,
    actor: JwtPayload,
  ): Promise<void> {
    const course = await manager.getRepository(Course).findOneBy({ idCourse: target.courseId });
    if (!course) throw new NotFoundException('Materia/grupo no encontrado');
    if (!course.isActive) throw new BadRequestException('La materia/grupo está inactiva');
    const semester = await manager
      .getRepository(Semester)
      .findOneBy({ idSemester: target.semesterId });
    if (!semester) throw new NotFoundException('Semestre no encontrado');
    if (!semester.isActive) throw new BadRequestException('El semestre está inactivo');

    // General permissions are enforced by PermissionsGuard. Keep the existing assistant ownership rule.
    if (
      actor.roles.includes('ASSISTANT') &&
      !actor.roles.some((role) => role === 'ADMIN' || role === 'SUPERADMIN')
    ) {
      const assignment = await manager.getRepository(Enrollment).findOneBy({
        user: { idUser: actor.idUser },
        course: { idCourse: target.courseId },
        semester: { idSemester: target.semesterId },
        role: CourseRelations.ASSISTANT,
        isActive: true,
      });
      if (!assignment)
        throw new ForbiddenException(
          'No tienes permisos para gestionar esta materia durante este semestre',
        );
    }
  }

  private async validateRows(
    manager: EntityManager,
    inputs: EnrollmentImportInputRow[],
    target: EnrollmentImportTargetDto,
  ): Promise<EnrollmentImportPreviewDto> {
    const counts = new Map<string, number>();
    for (const row of inputs) if (row.ru) counts.set(row.ru, (counts.get(row.ru) ?? 0) + 1);
    const rus = [...counts.keys()];
    const users = new Map<string, User>();
    for (let offset = 0; offset < rus.length; offset += BATCH_SIZE) {
      const batch = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .withDeleted()
        .leftJoinAndSelect('user.roles', 'role')
        .select([
          'user.idUser',
          'user.ru',
          'user.name',
          'user.lastname',
          'user.username',
          'user.email',
          'user.isActive',
          'user.deletedAt',
          'role.idRole',
          'role.name',
          'role.isActive',
          'role.deletedAt',
        ])
        .where('user.ru IN (:...rus)', { rus: rus.slice(offset, offset + BATCH_SIZE) })
        .getMany();
      for (const user of batch) if (user.ru) users.set(user.ru, user);
    }
    const ids = [...users.values()].map((user) => user.idUser);
    const enrolled = new Set<number>();
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const existing = await manager.getRepository(Enrollment).find({
        withDeleted: true,
        where: {
          course: { idCourse: target.courseId },
          semester: { idSemester: target.semesterId },
          user: { idUser: In(ids.slice(offset, offset + BATCH_SIZE)) },
        },
        relations: { user: true },
        select: { idEnrollment: true, user: { idUser: true } },
      });
      for (const entry of existing) enrolled.add(entry.user.idUser);
    }
    const rows: EnrollmentImportRowDto[] = inputs.map((input) => {
      const errors = [...input.errors];
      const user = users.get(input.ru);
      if ((counts.get(input.ru) ?? 0) > 1) errors.push('El RU está duplicado dentro del archivo');
      if (input.ru && !user) errors.push('No existe un estudiante con este RU');
      if (user) {
        if (!user.isActive || user.deletedAt) errors.push('El usuario está inactivo o eliminado');
        if (!user.roles.some((role) => role.name === 'STUDENT' && role.isActive && !role.deletedAt))
          errors.push('El usuario no tiene un rol de estudiante activo');
        if (enrolled.has(user.idUser))
          errors.push(
            'El usuario ya tiene una matrícula en esta materia y semestre (incluye matrículas inactivas)',
          );
      }
      return {
        row: input.row,
        studentId: user?.idUser ?? null,
        ru: input.ru,
        fullName: user ? `${user.name} ${user.lastname}` : null,
        username: user?.username ?? null,
        email: user?.email ?? null,
        status: errors.length ? 'INVALID' : 'VALID',
        errors,
      };
    });
    const invalid = rows.filter((row) => row.status === 'INVALID').length;
    return { total: rows.length, valid: rows.length - invalid, invalid, rows };
  }

  private async handleErrors<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['23505', '40001', '40P01'].includes(String(error.code))
      )
        throw new ConflictException(
          'Los datos cambiaron o una matrícula ya existe. No se creó ninguna matrícula; vuelve a revisar el archivo.',
        );
      throw new InternalServerErrorException(
        'No se pudo procesar la importación. No se creó ninguna matrícula.',
      );
    }
  }
}
