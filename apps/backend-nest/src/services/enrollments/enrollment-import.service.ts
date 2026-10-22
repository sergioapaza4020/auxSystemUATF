import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { Role } from 'src/entities/roles/roles.entity';
import { userImportUsername } from '../users/user-import-rules';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { BulkOperationType, BulkOperationStatus } from '@common/enums/bulk-operation';
import { ImportPreviewQueryDto } from 'src/dtos/bulk-operations/import-preview.dto';
import {
  studentImportPreviewRow,
  studentImportSearchCondition,
} from '@common/imports/student-import-preview';
import type { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
type ResolvedRow = EnrollmentImportRowDto & { input: EnrollmentImportInputRow };

@Injectable()
export class EnrollmentImportService {
  private readonly logger = new Logger(EnrollmentImportService.name);
  constructor(
    @InjectRepository(Enrollment) private readonly repository: Repository<Enrollment>,
    private readonly bulk: BulkOperationsService,
  ) {}

  async template(target: EnrollmentImportTargetDto, actor: JwtPayload): Promise<Buffer> {
    return this.handleErrors(async () => {
      await this.validateTarget(this.repository.manager, target, actor);
      return createEnrollmentImportTemplate();
    }, 'template');
  }

  async preview(
    file: Express.Multer.File | undefined,
    target: EnrollmentImportTargetDto,
    actor: JwtPayload,
  ): Promise<EnrollmentImportPreviewDto> {
    return this.handleErrors(async () => {
      await this.validateTarget(this.repository.manager, target, actor);
      const preview = await this.validateRows(
        this.repository.manager,
        await parseEnrollmentImport(file),
        target,
      );
      const operation = await this.bulk.create(
        {
          type: BulkOperationType.ENROLLMENT_IMPORT,
          metadata: {
            ...target,
            originalFileName: file?.originalname ?? '',
            newAccounts: preview.rows.filter((row) => row.action === 'CREATE_ACCOUNT').length,
            existingAccounts: preview.rows.filter((row) => row.action === 'ENROLL').length,
            skipped: preview.rows.filter((row) => row.action === 'SKIP').length,
          },
        },
        actor.idUser,
        preview.rows.map((row) => ({
          rowNumber: row.row,
          valid: row.status === 'VALID',
          errors: row.errors,
          data: {
            input: {
              name: row.input.name ?? '',
              lastname: row.input.lastname ?? '',
              ci: row.input.ci ?? '',
              email: row.input.email ?? '',
            },
            action: row.action ?? 'ERROR',
            studentId: row.studentId,
            ru: row.ru,
            fullName: row.fullName,
            username: row.username,
            email: row.email,
          },
        })),
      );
      try {
        await this.bulk.update(operation.idBulkOperation, actor.idUser, {
          status: BulkOperationStatus.READY,
        });
      } catch (cause) {
        await this.bulk
          .update(operation.idBulkOperation, actor.idUser, { status: BulkOperationStatus.FAILED })
          .catch(() => undefined);
        throw cause;
      }
      return this.getPreview(operation.idBulkOperation, actor);
    }, 'preview');
  }

  private async operation(operationId: string, ownerId: number) {
    const operation = await this.bulk.getById(operationId, ownerId);
    if (operation.type !== BulkOperationType.ENROLLMENT_IMPORT)
      throw new NotFoundException('Enrollment import not found');
    return operation;
  }

  private target(operation: BulkOperation): EnrollmentImportTargetDto {
    const { courseId, semesterId } = operation.metadata ?? {};
    if (
      typeof courseId !== 'number' ||
      !Number.isSafeInteger(courseId) ||
      courseId < 1 ||
      typeof semesterId !== 'number' ||
      !Number.isSafeInteger(semesterId) ||
      semesterId < 1
    )
      throw new InternalServerErrorException('Invalid enrollment import context');
    return { courseId, semesterId };
  }

  async getPreview(
    operationId: string,
    actor: JwtPayload,
    query = new ImportPreviewQueryDto(),
  ): Promise<EnrollmentImportPreviewDto> {
    const operation = await this.operation(operationId, actor.idUser);
    if (operation.status !== BulkOperationStatus.READY)
      throw new BadRequestException('Enrollment import preview is not ready');
    await this.validateTarget(this.repository.manager, this.target(operation), actor);
    const rows = await this.bulk.findRows(
      operationId,
      actor.idUser,
      {
        page: query.page,
        limit: query.limit,
        valid: query.status === 'all' ? undefined : query.status === 'valid',
      },
      studentImportSearchCondition(query.search),
    );
    return {
      operationId,
      total: operation.totalRows,
      valid: operation.validRows,
      invalid: operation.invalidRows,
      newAccounts: Number(operation.metadata?.newAccounts ?? 0),
      existingAccounts: Number(operation.metadata?.existingAccounts ?? 0),
      skipped: Number(operation.metadata?.skipped ?? 0),
      data: rows.data.map((row) => ({
        ...studentImportPreviewRow(row),
        action: this.rowAction(row.data.action, row.valid),
      })),
      meta: rows.meta,
    };
  }

  async status(operationId: string, actor: JwtPayload) {
    const operation = await this.operation(operationId, actor.idUser);
    return {
      operationId,
      status: operation.status,
      total: operation.totalRows,
      valid: operation.validRows,
      invalid: operation.invalidRows,
      imported: this.completedResult(operation)?.imported ?? operation.processedRows,
      failed: operation.failedRows,
      result: this.completedResult(operation),
    };
  }

  async import(operationId: string, actor: JwtPayload): Promise<EnrollmentImportResultDto> {
    return this.handleErrors(async () => {
      const operation = await this.operation(operationId, actor.idUser);
      const completed = this.completedResult(operation);
      if (operation.status === BulkOperationStatus.COMPLETED && completed) {
        await this.validateTarget(this.repository.manager, this.target(operation), actor);
        return completed;
      }
      if (operation.invalidRows)
        throw new BadRequestException(
          `El archivo contiene ${operation.invalidRows} filas inválidas. No se creó ninguna matrícula. Vuelve a revisar el archivo.`,
        );
      return this.bulk.executeReady(
        operationId,
        actor.idUser,
        BulkOperationType.ENROLLMENT_IMPORT,
        async (manager, persisted, rows) => {
          const target = this.target(persisted);
          await this.validateTarget(manager, target, actor);
          const inputs: EnrollmentImportInputRow[] = rows.map((row) => {
            const data = row.data.input;
            const fields = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
            const text = (key: string) => (typeof fields[key] === 'string' ? fields[key] : '');
            return {
              row: row.rowNumber,
              ru: studentImportPreviewRow(row).ru,
              name: text('name'),
              lastname: text('lastname'),
              ci: text('ci'),
              email: text('email'),
              errors: [],
            };
          });
          const preview = await this.validateRows(manager, inputs, target);
          if (
            preview.invalid > 0 ||
            preview.rows.some(
              (row, index) =>
                rows[index].data.studentId !== null && row.studentId !== rows[index].data.studentId,
            )
          )
            throw new BadRequestException(
              'Los datos cambiaron o existen filas inválidas. No se crearon cuentas ni matrículas; vuelve a revisar el archivo.',
            );
          const role = preview.rows.some((row) => row.action === 'CREATE_ACCOUNT')
            ? await manager.getRepository(Role).findOneBy({ name: 'STUDENT', isActive: true })
            : null;
          if (preview.rows.some((row) => row.action === 'CREATE_ACCOUNT') && !role)
            throw new BadRequestException('El rol STUDENT no está disponible');
          let accountsCreated = 0,
            accountsReused = 0,
            skipped = 0;
          const values: {
            user: { idUser: number };
            course: { idCourse: number };
            semester: { idSemester: number };
            role: CourseRelations;
            createdBy: number;
          }[] = [];
          for (const row of preview.rows) {
            if (row.action === 'SKIP') {
              skipped++;
              continue;
            }
            let idUser = row.studentId;
            if (row.action === 'CREATE_ACCOUNT' && role) {
              const repository = manager.getRepository(User);
              const account = repository.create({
                name: row.input.name!,
                lastname: row.input.lastname!,
                ci: row.input.ci!,
                ru: row.ru,
                email: row.input.email!,
                username: userImportUsername('STUDENT', row.input.ci!, row.ru),
                password: await bcrypt.hash(row.input.ci!, 10),
                roles: [role],
                createdBy: actor.idUser,
              });
              idUser = (await repository.save(account)).idUser;
              accountsCreated++;
            } else accountsReused++;
            if (idUser === null) throw new BadRequestException('Estudiante no resuelto');
            values.push({
              user: { idUser },
              course: { idCourse: target.courseId },
              semester: { idSemester: target.semesterId },
              role: CourseRelations.STUDENT,
              createdBy: actor.idUser,
            });
          }
          for (let offset = 0; offset < values.length; offset += BATCH_SIZE)
            await manager
              .getRepository(Enrollment)
              .insert(values.slice(offset, offset + BATCH_SIZE));
          const result = {
            imported: values.length,
            total: preview.total,
            courseId: target.courseId,
            semesterId: target.semesterId,
            accountsCreated,
            accountsReused,
            skipped,
            errors: 0,
          };
          persisted.metadata = { ...persisted.metadata, result };
          return result;
        },
      );
    }, 'execute');
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
  ): Promise<{ total: number; valid: number; invalid: number; rows: ResolvedRow[] }> {
    const counts = (field: 'ru' | 'ci' | 'email') => {
      const map = new Map<string, number>();
      for (const input of inputs) {
        const value = input[field];
        if (value) map.set(value, (map.get(value) ?? 0) + 1);
      }
      return map;
    };
    const ruCounts = counts('ru'),
      ciCounts = counts('ci'),
      emailCounts = counts('email');
    const found = new Map<number, User>();
    for (let offset = 0; offset < inputs.length; offset += BATCH_SIZE) {
      const batch = inputs.slice(offset, offset + BATCH_SIZE);
      const batchRus = batch.map((row) => row.ru).filter(Boolean);
      const cis = batch.map((row) => row.ci).filter((value): value is string => !!value);
      const emails = batch.map((row) => row.email).filter((value): value is string => !!value);
      const conditions = ['user.ru IN (:...rus)', 'user.username IN (:...rus)'];
      if (cis.length) conditions.push('user.ci IN (:...cis)');
      if (emails.length) conditions.push('LOWER(user.email) IN (:...emails)');
      if (!batchRus.length) continue;
      const users = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .withDeleted()
        .leftJoinAndSelect('user.roles', 'role')
        .select([
          'user.idUser',
          'user.ru',
          'user.ci',
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
        .where(conditions.join(' OR '), { rus: batchRus, cis, emails })
        .getMany();
      for (const user of users) found.set(user.idUser, user);
    }
    const byRu = new Map(
      [...found.values()].filter((user) => user.ru).map((user) => [user.ru!, user]),
    );
    const byCi = new Map([...found.values()].map((user) => [user.ci, user]));
    const byEmail = new Map([...found.values()].map((user) => [user.email.toLowerCase(), user]));
    const byUsername = new Map([...found.values()].map((user) => [user.username, user]));
    const ids = [...found.keys()];
    const enrolled = new Map<number, Enrollment>();
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const existing = await manager.getRepository(Enrollment).find({
        withDeleted: true,
        where: {
          course: { idCourse: target.courseId },
          semester: { idSemester: target.semesterId },
          user: { idUser: In(ids.slice(offset, offset + BATCH_SIZE)) },
        },
        relations: { user: true },
        select: {
          idEnrollment: true,
          role: true,
          isActive: true,
          deletedAt: true,
          user: { idUser: true },
        },
      });
      for (const entry of existing) enrolled.set(entry.user.idUser, entry);
    }
    const rows: ResolvedRow[] = inputs.map((input) => {
      const errors = [...input.errors];
      const user = byRu.get(input.ru);
      for (const [field, map] of [
        ['RU', ruCounts],
        ['CI', ciCounts],
        ['email', emailCounts],
      ] as const) {
        const value = field === 'RU' ? input.ru : field === 'CI' ? input.ci : input.email;
        if (value && (map.get(value) ?? 0) > 1)
          errors.push(`El ${field} está duplicado dentro del archivo`);
      }
      if (!input.ru && !errors.includes('El RU es obligatorio'))
        errors.push('El RU es obligatorio');
      const conflict = (match: User | undefined) => match && match.idUser !== user?.idUser;
      if (conflict(byUsername.get(input.ru)))
        errors.push('El username RU pertenece a otra identidad');
      if (input.ci && conflict(byCi.get(input.ci))) errors.push('El CI pertenece a otra identidad');
      if (input.email && conflict(byEmail.get(input.email)))
        errors.push('El email pertenece a otra identidad');
      let action: EnrollmentImportRowDto['action'] = user ? 'ENROLL' : 'CREATE_ACCOUNT';
      if (user) {
        if (!user.isActive || user.deletedAt) errors.push('El usuario está inactivo o eliminado');
        if (!user.roles.some((role) => role.name === 'STUDENT' && role.isActive && !role.deletedAt))
          errors.push('El usuario no tiene un rol de estudiante activo');
        if (input.ci && input.ci !== user.ci)
          errors.push('El CI no coincide con el estudiante identificado por RU');
        const enrollment = enrolled.get(user.idUser);
        if (enrollment) {
          if (
            enrollment.isActive &&
            !enrollment.deletedAt &&
            enrollment.role === CourseRelations.STUDENT
          )
            action = 'SKIP';
          else
            errors.push(
              'Existe una matrícula inactiva, eliminada o de otra participación en este destino',
            );
        }
      } else {
        if (!input.name) errors.push('Nombres es obligatorio para crear una cuenta');
        if (!input.lastname) errors.push('Apellidos es obligatorio para crear una cuenta');
        if (!input.ci) errors.push('CI es obligatorio para crear una cuenta');
        if (!input.email || !isEmail(input.email))
          errors.push('Email válido es obligatorio para crear una cuenta');
      }
      return {
        row: input.row,
        studentId: user?.idUser ?? null,
        ru: input.ru,
        fullName: user
          ? `${user.name} ${user.lastname}`
          : `${input.name ?? ''} ${input.lastname ?? ''}`.trim() || null,
        username: user?.username ?? input.ru,
        email: user?.email ?? input.email ?? null,
        status: errors.length ? 'INVALID' : 'VALID',
        action: errors.length ? 'ERROR' : action,
        errors,
        input,
      };
    });
    const invalid = rows.filter((row) => row.status === 'INVALID').length;
    return { total: rows.length, valid: rows.length - invalid, invalid, rows };
  }

  private rowAction(value: unknown, valid: boolean): EnrollmentImportRowDto['action'] {
    return value === 'CREATE_ACCOUNT' || value === 'ENROLL' || value === 'SKIP' || value === 'ERROR'
      ? value
      : valid
        ? 'ENROLL'
        : 'ERROR';
  }

  private completedResult(operation: BulkOperation): EnrollmentImportResultDto | undefined {
    const value = operation.metadata?.result;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const keys = [
      'imported',
      'total',
      'courseId',
      'semesterId',
      'accountsCreated',
      'accountsReused',
      'skipped',
      'errors',
    ] as const;
    if (
      !keys.every(
        (key) =>
          typeof value[key] === 'number' &&
          Number.isSafeInteger(value[key]) &&
          Number(value[key]) >= 0,
      )
    )
      return undefined;
    return {
      imported: Number(value.imported),
      total: Number(value.total),
      courseId: Number(value.courseId),
      semesterId: Number(value.semesterId),
      accountsCreated: Number(value.accountsCreated),
      accountsReused: Number(value.accountsReused),
      skipped: Number(value.skipped),
      errors: Number(value.errors),
    };
  }

  private async handleErrors<T>(
    action: () => Promise<T>,
    phase: 'template' | 'preview' | 'execute',
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await action();
      } catch (error: unknown) {
        if (error instanceof HttpException) throw error;
        // Log only structural diagnostics. Queries, parameters, messages and stacks may contain PII.
        const detail = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
        const text = (key: string) => (typeof detail[key] === 'string' ? detail[key] : undefined);
        const code = text('code');
        this.logger.error({
          event: 'enrollment_import_failed',
          phase,
          code,
          table: text('table'),
          column: text('column'),
          constraint: text('constraint'),
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        if (
          code === '22P02' &&
          text('message')?.includes('bulk_operations_type_enum') &&
          text('message')?.includes('ENROLLMENT_IMPORT')
        ) {
          throw new ServiceUnavailableException(
            'La importación de matrículas no está habilitada en esta base de datos. El administrador debe aplicar la actualización pendiente de importaciones académicas.',
          );
        }
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          ['23505', '40001', '40P01'].includes(String(error.code))
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Los datos cambiaron concurrentemente. No se crearon cuentas ni matrículas; vuelve a revisar el archivo.',
          );
        }
        throw new InternalServerErrorException(
          'No se pudo procesar la importación. No se crearon cuentas ni matrículas.',
        );
      }
    }
  }
}
