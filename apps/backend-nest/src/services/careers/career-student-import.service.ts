import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Career } from 'src/entities/careers/careers.entity';
import { User } from 'src/entities/users/users.entity';
import {
  CareerStudentImportPreviewDto,
  CareerStudentImportResultDto,
  CareerStudentImportRowDto,
} from 'src/dtos/careers/career-student-import.dto';
import {
  createStudentRuImportTemplate,
  parseStudentRuImport,
  StudentRuImportInputRow,
} from '@common/imports/student-ru-import';

const BATCH_SIZE = 500;

@Injectable()
export class CareerStudentImportService {
  constructor(@InjectRepository(Career) private readonly repository: Repository<Career>) {}

  async template(careerId: number): Promise<Buffer> {
    return this.handleErrors(async () => {
      await this.validateCareer(this.repository.manager, careerId);
      return createStudentRuImportTemplate(
        'Un RU por fila. Ejemplos ficticios: 123456 y 654321. Conserve los ceros iniciales como texto. No incluya la carrera. Solo estudiantes existentes sin carrera asignada.',
      );
    });
  }

  async preview(
    file: Express.Multer.File | undefined,
    careerId: number,
  ): Promise<CareerStudentImportPreviewDto> {
    return this.handleErrors(async () => {
      await this.validateCareer(this.repository.manager, careerId);
      return this.validateRows(this.repository.manager, await parseStudentRuImport(file), careerId);
    });
  }

  async import(
    file: Express.Multer.File | undefined,
    careerId: number,
    authorId: number,
  ): Promise<CareerStudentImportResultDto> {
    return this.handleErrors(async () => {
      const inputs = await parseStudentRuImport(file);
      return this.repository.manager.transaction('SERIALIZABLE', async (manager) => {
        await this.validateCareer(manager, careerId);
        const preview = await this.validateRows(manager, inputs, careerId);
        if (preview.invalid)
          throw new BadRequestException(
            `El archivo contiene ${preview.invalid} filas inválidas. No se realizó ninguna asignación. Vuelve a revisar el archivo.`,
          );
        // The conditional update is a second line of protection against concurrent reassignment.
        for (let offset = 0; offset < preview.rows.length; offset += BATCH_SIZE) {
          const ids = preview.rows.slice(offset, offset + BATCH_SIZE).map((row) => {
            if (row.studentId === null) throw new BadRequestException('Estudiante no resuelto');
            return row.studentId;
          });
          const updated = await manager
            .getRepository(User)
            .createQueryBuilder()
            .update(User)
            .set({ careers: { idCareer: careerId }, updatedBy: authorId })
            .where('id_user IN (:...ids)', { ids })
            .andWhere('careers IS NULL')
            .andWhere('is_active = true')
            .andWhere('deleted_at IS NULL')
            .execute();
          if (updated.affected !== ids.length)
            throw new ConflictException(
              'Los estudiantes cambiaron durante la importación. No se realizó ninguna asignación; vuelve a revisar el archivo.',
            );
        }
        return { imported: preview.total, total: preview.total, careerId };
      });
    });
  }

  private async validateCareer(manager: EntityManager, careerId: number): Promise<void> {
    const career = await manager.getRepository(Career).findOneBy({ idCareer: careerId });
    if (!career) throw new NotFoundException('Carrera no encontrada');
    if (!career.isActive) throw new BadRequestException('La carrera está inactiva');
  }

  private async validateRows(
    manager: EntityManager,
    inputs: StudentRuImportInputRow[],
    careerId: number,
  ): Promise<CareerStudentImportPreviewDto> {
    const counts = new Map<string, number>();
    for (const row of inputs) if (row.ru) counts.set(row.ru, (counts.get(row.ru) ?? 0) + 1);
    const rus = [...counts.keys()];
    const users = new Map<string, User>();
    for (let offset = 0; offset < rus.length; offset += BATCH_SIZE) {
      // Include soft-deleted related careers: their FK still occupies the student's only slot.
      const batch = await manager
        .getRepository(User)
        .createQueryBuilder('student')
        .withDeleted()
        .leftJoinAndSelect('student.roles', 'role')
        .leftJoinAndSelect('student.careers', 'career')
        .select([
          'student.idUser',
          'student.ru',
          'student.name',
          'student.lastname',
          'student.username',
          'student.email',
          'student.isActive',
          'student.deletedAt',
          'role.idRole',
          'role.name',
          'role.isActive',
          'role.deletedAt',
          'career.idCareer',
          'career.name',
        ])
        .where('student.ru IN (:...rus)', { rus: rus.slice(offset, offset + BATCH_SIZE) })
        .getMany();
      for (const user of batch) if (user.ru) users.set(user.ru, user);
    }
    const rows: CareerStudentImportRowDto[] = inputs.map((input) => {
      const errors = [...input.errors];
      const student = users.get(input.ru);
      if ((counts.get(input.ru) ?? 0) > 1) errors.push('El RU está duplicado dentro del archivo');
      if (input.ru && !student) errors.push('No existe un estudiante con este RU');
      if (student) {
        if (!student.isActive || student.deletedAt)
          errors.push('El usuario está inactivo o eliminado');
        if (
          !student.roles.some((role) => role.name === 'STUDENT' && role.isActive && !role.deletedAt)
        )
          errors.push('El usuario no tiene un rol de estudiante activo');
        if (student.careers)
          errors.push(
            student.careers.idCareer === careerId
              ? 'El estudiante ya está asignado a la carrera destino'
              : `El estudiante ya pertenece a la carrera ${student.careers.name}. No se permite cambiar de carrera mediante esta importación.`,
          );
      }
      return {
        row: input.row,
        studentId: student?.idUser ?? null,
        ru: input.ru,
        fullName: student ? `${student.name} ${student.lastname}` : null,
        username: student?.username ?? null,
        email: student?.email ?? null,
        currentCareer: student?.careers
          ? { idCareer: student.careers.idCareer, name: student.careers.name }
          : null,
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
        typeof error.code === 'string' &&
        ['23505', '23503', '40001', '40P01'].includes(error.code)
      )
        throw new ConflictException(
          'Los datos cambiaron durante la importación. No se realizó ninguna asignación; vuelve a revisar el archivo.',
        );
      throw new InternalServerErrorException(
        'No se pudo completar la importación de estudiantes a la carrera.',
      );
    }
  }
}
