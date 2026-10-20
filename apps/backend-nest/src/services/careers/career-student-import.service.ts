import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import { ImportPreviewQueryDto } from 'src/dtos/bulk-operations/import-preview.dto';
import {
  studentImportPreviewRow,
  studentImportSearchCondition,
} from '@common/imports/student-import-preview';
import type { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import type { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
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
  constructor(
    @InjectRepository(Career) private readonly repository: Repository<Career>,
    private readonly bulk: BulkOperationsService,
  ) {}

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
    ownerId: number,
  ): Promise<CareerStudentImportPreviewDto> {
    return this.handleErrors(async () => {
      await this.validateCareer(this.repository.manager, careerId);
      const preview = await this.validateRows(
        this.repository.manager,
        await parseStudentRuImport(file),
        careerId,
      );
      const operation = await this.bulk.create(
        {
          type: BulkOperationType.CAREER_STUDENT_IMPORT,
          metadata: { careerId, originalFileName: file?.originalname ?? '' },
        },
        ownerId,
        preview.rows.map((row) => ({
          rowNumber: row.row,
          valid: row.status === 'VALID',
          errors: row.errors,
          data: {
            studentId: row.studentId,
            ru: row.ru,
            fullName: row.fullName,
            username: row.username,
            email: row.email,
            currentCareer: row.currentCareer,
          },
        })),
      );
      try {
        await this.bulk.update(operation.idBulkOperation, ownerId, {
          status: BulkOperationStatus.READY,
        });
      } catch (cause) {
        await this.bulk
          .update(operation.idBulkOperation, ownerId, { status: BulkOperationStatus.FAILED })
          .catch(() => undefined);
        throw cause;
      }
      return this.getPreview(operation.idBulkOperation, careerId, ownerId);
    });
  }

  private async operation(operationId: string, careerId: number, ownerId: number) {
    const operation = await this.bulk.getById(operationId, ownerId);
    if (
      operation.type !== BulkOperationType.CAREER_STUDENT_IMPORT ||
      operation.metadata?.careerId !== careerId
    )
      throw new NotFoundException('Career student import not found');
    return operation;
  }

  private target(operation: BulkOperation): number {
    const careerId = operation.metadata?.careerId;
    if (typeof careerId !== 'number' || !Number.isSafeInteger(careerId) || careerId < 1)
      throw new InternalServerErrorException('Invalid career import context');
    return careerId;
  }

  private row(row: BulkOperationRow): CareerStudentImportRowDto {
    const career = row.data.currentCareer;
    if (
      career !== null &&
      (typeof career !== 'object' ||
        Array.isArray(career) ||
        typeof career.idCareer !== 'number' ||
        typeof career.name !== 'string')
    )
      throw new InternalServerErrorException('Invalid career import row');
    return {
      ...studentImportPreviewRow(row),
      currentCareer:
        career === null
          ? null
          : { idCareer: career.idCareer as number, name: career.name as string },
    };
  }

  async getPreview(
    operationId: string,
    careerId: number,
    ownerId: number,
    query = new ImportPreviewQueryDto(),
  ): Promise<CareerStudentImportPreviewDto> {
    const operation = await this.operation(operationId, careerId, ownerId);
    if (operation.status !== BulkOperationStatus.READY)
      throw new BadRequestException('Career student import preview is not ready');
    await this.validateCareer(this.repository.manager, this.target(operation));
    const rows = await this.bulk.findRows(
      operationId,
      ownerId,
      {
        page: query.page,
        limit: query.limit,
        valid: query.status === 'all' ? undefined : query.status === 'valid',
      },
      studentImportSearchCondition(query.search, true),
    );
    return {
      operationId,
      total: operation.totalRows,
      valid: operation.validRows,
      invalid: operation.invalidRows,
      data: rows.data.map((row) => this.row(row)),
      meta: rows.meta,
    };
  }

  async status(operationId: string, careerId: number, ownerId: number) {
    const operation = await this.operation(operationId, careerId, ownerId);
    return {
      operationId,
      status: operation.status,
      total: operation.totalRows,
      valid: operation.validRows,
      invalid: operation.invalidRows,
      imported: operation.processedRows,
      failed: operation.failedRows,
    };
  }

  async import(
    operationId: string,
    routeCareerId: number,
    authorId: number,
  ): Promise<CareerStudentImportResultDto> {
    return this.handleErrors(async () => {
      const operation = await this.operation(operationId, routeCareerId, authorId);
      if (operation.invalidRows)
        throw new BadRequestException(
          `El archivo contiene ${operation.invalidRows} filas inválidas. No se realizó ninguna asignación. Vuelve a revisar el archivo.`,
        );
      return this.bulk.executeReady(
        operationId,
        authorId,
        BulkOperationType.CAREER_STUDENT_IMPORT,
        async (manager, persisted, rows) => {
          const careerId = this.target(persisted);
          if (careerId !== routeCareerId)
            throw new NotFoundException('Career student import not found');
          await this.validateCareer(manager, careerId);
          const inputs = rows.map((row) => ({
            row: row.rowNumber,
            ru: studentImportPreviewRow(row).ru,
            errors: [],
          }));
          const preview = await this.validateRows(manager, inputs, careerId);
          if (
            preview.invalid ||
            preview.rows.some((row, index) => row.studentId !== rows[index].data.studentId)
          )
            throw new BadRequestException(
              `El archivo contiene ${preview.invalid || 1} filas inválidas. No se realizó ninguna asignación. Vuelve a revisar el archivo.`,
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
        },
      );
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
  ): Promise<{ total: number; valid: number; invalid: number; rows: CareerStudentImportRowDto[] }> {
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
