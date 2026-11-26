import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseRelations } from '@common/enums/courseRelations';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import { AttendanceSessionMode } from '@common/enums/attendanceSessionMode';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { isProtectedAttendanceEvidence } from '@common/utils/attendance-evidence';
import {
  attendanceAcademicDate,
  attendanceDateValue,
  getAttendanceSessionState,
} from '@common/utils/attendance-session-policy';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { AttendancesService } from './attendances.service';
import { attendanceWorkbook, readAttendanceWorkbook } from './attendance-import-excel';

type Workbook = Awaited<ReturnType<typeof readAttendanceWorkbook>>;
export type AttendanceImportChoice = { column: string; sessionId: number | 'create' };
export type AttendanceImportOptions = {
  choices: AttendanceImportChoice[];
  updateExisting: boolean;
};

const can = (user: JwtPayload, permission: string) =>
  user.roles.includes('SUPERADMIN') || user.permissions.includes(permission);

@Injectable()
export class AttendanceImportService {
  constructor(
    private readonly database: DataSource,
    private readonly attendance: AttendancesService,
    private readonly bulk: BulkOperationsService,
  ) {}

  private async assistant(manager: EntityManager, user: JwtPayload, enrollmentId: number) {
    if (
      ![
        'attendance.save',
        'attendance.session.get-by-enrollment',
        'enrollment.get-students-by-enrollment',
      ].every((permission) => can(user, permission))
    ) {
      throw new ForbiddenException(
        'Se requieren permisos de registro de asistencia y consulta de sesiones y estudiantes',
      );
    }
    return this.attendance.getAssistantEnrollment(user.idUser, enrollmentId, manager);
  }

  private students(manager: EntityManager, assistant: Enrollment) {
    return manager.getRepository(Enrollment).find({
      where: {
        role: CourseRelations.STUDENT,
        isActive: true,
        course: { idCourse: assistant.course.idCourse },
        semester: { idSemester: assistant.semester.idSemester },
      },
      relations: { user: true },
      order: { idEnrollment: 'ASC' },
    });
  }

  async template(user: JwtPayload, enrollmentId: number) {
    const manager = this.database.manager;
    const assistant = await this.assistant(manager, user, enrollmentId);
    const students = await this.students(manager, assistant);
    return attendanceWorkbook(
      students.flatMap((student) => (student.user.ru ? [student.user.ru.trim()] : [])),
    );
  }

  private async plan(
    manager: EntityManager,
    user: JwtPayload,
    enrollmentId: number,
    book: Workbook,
    options: AttendanceImportOptions,
  ) {
    const assistant = await this.assistant(manager, user, enrollmentId);
    const today = attendanceAcademicDate(new Date());
    const dates = book.columns.flatMap((column) => (column.date ? [column.date] : []));
    const sessions = dates.length
      ? await manager
          .getRepository(AttendanceSession)
          .createQueryBuilder('session')
          .where('session.id_assistant_enrollment = :enrollmentId', { enrollmentId })
          .andWhere('session.date IN (:...dates)', { dates })
          .orderBy('session.idAttendanceSession', 'ASC')
          .getMany()
      : [];
    const roster = await this.students(manager, assistant);
    const canCreate = can(user, 'attendance.session.create');
    const errors: { row: number; column: string; ru?: string; message: string }[] = [];
    const warnings: string[] = [];
    const columns = book.columns.map((column) => {
      const { date } = column;
      const choice = options.choices.find((item) => item.column === column.column)?.sessionId;
      const candidates = date
        ? sessions
            .filter((session) => attendanceDateValue(session.date) === date)
            .map((session) => ({
              id: session.idAttendanceSession,
              mode: session.mode,
              state: getAttendanceSessionState(session, new Date()) ?? 'MANUAL',
              editable:
                session.mode === AttendanceSessionMode.MANUAL &&
                !session.closedAt &&
                !session.cancelledAt,
            }))
        : [];
      const selected =
        typeof choice === 'number'
          ? candidates.find((item) => item.id === choice)
          : choice === undefined && candidates.length === 1
            ? candidates[0]
            : undefined;
      const allowCreate = Boolean(date && date >= today && !candidates.length && canCreate);
      const create = choice === 'create' && allowCreate;
      const fail = (message: string) => errors.push({ row: 1, column: column.column, message });
      if (!date) fail('Ingresa una fecha válida en formato dd/mm/aaaa');
      else if (dates.filter((value) => value === date).length > 1)
        fail('Fecha duplicada. Conserva una sola columna por fecha');
      else if (selected && !selected.editable)
        fail('La sesión está protegida. Usa una sesión manual editable');
      else if (!selected && !create) {
        if (candidates.length) fail('Selecciona una sesión manual de esta fecha');
        else if (date < today) fail('No se pueden crear sesiones con fecha pasada');
        else if (!canCreate) fail('Falta el permiso para crear sesiones');
        else fail('Confirma la creación de una sesión manual');
      }
      // Explicit key order keeps the fingerprint stable after a JSONB round trip.
      return { column: column.column, date, candidates, selected, allowCreate, create };
    });

    const studentsByRu = new Map<string, number[]>();
    for (const student of roster) {
      const ru = student.user.ru?.trim();
      if (ru) studentsByRu.set(ru, [...(studentsByRu.get(ru) ?? []), student.idEnrollment]);
    }
    const occurrences = new Map<string, number>();
    for (const row of book.rows) occurrences.set(row.ru, (occurrences.get(row.ru) ?? 0) + 1);
    const students = book.rows.flatMap((row) => studentsByRu.get(row.ru) ?? []);
    const sessionIds = columns.flatMap((column) =>
      column.selected?.editable ? [column.selected.id] : [],
    );
    const existing =
      students.length && sessionIds.length
        ? await manager.getRepository(Attendance).find({
            where: {
              attendanceSession: { idAttendanceSession: In(sessionIds) },
              enrollment: { idEnrollment: In(students) },
            },
            relations: { attendanceSession: true, enrollment: true },
          })
        : [];
    const old = new Map(
      existing.map((mark) => [
        `${mark.enrollment.idEnrollment}:${mark.attendanceSession.idAttendanceSession}`,
        mark,
      ]),
    );
    const cells: {
      row: number;
      ru: string;
      column: string;
      date: string | null;
      enrollmentId: number;
      sessionId: number | null;
      status: AttendanceStatus;
      empty: boolean;
      previous: AttendanceStatus | null;
      action: 'create' | 'update' | 'skip' | 'blocked';
      evidence: string | null;
      markedAt: string | null;
    }[] = [];
    let identified = 0;
    for (const row of book.rows) {
      const matches = studentsByRu.get(row.ru) ?? [];
      const eligible = Boolean(row.ru && matches.length === 1 && occurrences.get(row.ru) === 1);
      if (eligible) identified++;
      else
        errors.push({
          row: row.row,
          column: 'A',
          ru: row.ru,
          message: !row.ru
            ? 'Ingresa el RU'
            : (occurrences.get(row.ru) ?? 0) > 1
              ? 'RU repetido. Consolida las filas en Excel'
              : 'Comprueba la matrícula activa para esta materia y semestre',
        });
      row.marks.forEach(({ status, empty }, index) => {
        const column = columns[index];
        if (status === null) {
          errors.push({
            row: row.row,
            column: column.column,
            ru: row.ru,
            message: 'Usa 0, 1, 2 o una celda vacía',
          });
          return;
        }
        if (!eligible) return;
        const sessionId = column.selected?.id ?? null;
        const previous = old.get(`${matches[0]}:${sessionId}`);
        const blocked =
          (!column.selected?.editable && !column.create) ||
          Boolean(
            options.updateExisting &&
            previous &&
            isProtectedAttendanceEvidence(previous.registrationMethod),
          );
        if (blocked && previous) {
          errors.push({
            row: row.row,
            column: column.column,
            ru: row.ru,
            message: 'La marca tiene evidencia protegida. Selecciona omitir registros existentes',
          });
        }
        cells.push({
          row: row.row,
          ru: row.ru,
          enrollmentId: matches[0],
          column: column.column,
          date: column.date,
          sessionId,
          status,
          empty,
          previous: previous?.status ?? null,
          evidence: previous?.registrationMethod ?? null,
          markedAt: previous?.markedAt?.toISOString() ?? null,
          action: blocked
            ? 'blocked'
            : previous
              ? options.updateExisting
                ? 'update'
                : 'skip'
              : 'create',
        });
      });
    }
    const emptyOverwrites = cells.filter(
      (cell) => cell.empty && cell.action === 'update' && cell.previous !== AttendanceStatus.ABSENT,
    ).length;
    if (emptyOverwrites)
      warnings.push(
        `${emptyOverwrites} celdas vacías sustituirán marcas presentes o con permiso por ausencias`,
      );
    const summary = {
      identified,
      dates: new Set(dates).size,
      reused: columns.filter((column) => column.selected?.editable).length,
      newSessions: columns.filter((column) => column.create).length,
      present: cells.filter((cell) => cell.status === AttendanceStatus.PRESENT).length,
      absent: cells.filter((cell) => cell.status === AttendanceStatus.ABSENT).length,
      excused: cells.filter((cell) => cell.status === AttendanceStatus.EXCUSED).length,
      empty: cells.filter((cell) => cell.empty).length,
      created: cells.filter((cell) => cell.action === 'create').length,
      updated: cells.filter((cell) => cell.action === 'update').length,
      skipped: cells.filter((cell) => cell.action === 'skip').length,
      errors: errors.length,
      warnings: warnings.length,
    };
    const courseId = assistant.course.idCourse;
    const semesterId = assistant.semester.idSemester;
    const snapshot = createHash('sha256')
      .update(JSON.stringify({ courseId, semesterId, columns, cells }))
      .digest('hex');
    return { courseId, semesterId, columns, cells, errors, warnings, summary, snapshot };
  }

  async preview(
    user: JwtPayload,
    enrollmentId: number,
    file: Express.Multer.File | undefined,
    options: AttendanceImportOptions,
  ) {
    await this.assistant(this.database.manager, user, enrollmentId);
    const book = await readAttendanceWorkbook(file);
    const { snapshot, ...preview } = await this.database.transaction('REPEATABLE READ', (manager) =>
      this.plan(manager, user, enrollmentId, book, options),
    );
    let operationId: string | null = null;
    if (!preview.errors.length) {
      const operation = await this.bulk.create(
        {
          type: BulkOperationType.ATTENDANCE_IMPORT,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          metadata: {
            enrollmentId,
            courseId: preview.courseId,
            semesterId: preview.semesterId,
            file: file?.originalname ?? '',
            bytes: file?.size ?? 0,
            columns: book.columns,
            choices: options.choices,
            updateExisting: options.updateExisting,
            snapshot,
          },
        },
        user.idUser,
        book.rows.map(({ row, ...data }) => ({ rowNumber: row, data, valid: true })),
      );
      operationId = operation.idBulkOperation;
      await this.bulk.update(operationId, user.idUser, { status: BulkOperationStatus.READY });
    }
    return {
      ...preview,
      operationId,
      cells: preview.cells.map(
        ({ row, ru, column, date, sessionId, status, empty, previous, action }) => ({
          row,
          ru,
          column,
          date,
          sessionId,
          status,
          empty,
          previous,
          action,
        }),
      ),
    };
  }

  async confirm(user: JwtPayload, enrollmentId: number, operationId: string) {
    await this.assistant(this.database.manager, user, enrollmentId);
    const previous = await this.bulk.getById(operationId, user.idUser);
    if (
      previous.type !== BulkOperationType.ATTENDANCE_IMPORT ||
      previous.metadata?.enrollmentId !== enrollmentId
    )
      throw new NotFoundException('Operación fuera de la matrícula seleccionada');
    if (previous.status === BulkOperationStatus.COMPLETED) return previous.metadata.result;
    try {
      return await this.bulk.executeReady(
        operationId,
        user.idUser,
        BulkOperationType.ATTENDANCE_IMPORT,
        async (manager, operation, rows) => {
          const metadata = operation.metadata;
          if (!metadata || metadata.enrollmentId !== enrollmentId)
            throw new NotFoundException('Operación fuera de la matrícula seleccionada');
          // Advance the assistant-enrollment row version to serialize competing imports in this context.
          await manager.query(
            'UPDATE "enrollments" SET "id_enrollment" = "id_enrollment" WHERE "id_enrollment" = $1',
            [enrollmentId],
          );
          const book: Workbook = {
            columns: metadata.columns as Workbook['columns'],
            rows: rows.map(({ rowNumber, data }) => ({
              row: rowNumber,
              ru: typeof data.ru === 'string' ? data.ru : '',
              marks: data.marks as Workbook['rows'][number]['marks'],
            })),
          };
          const plan = await this.plan(manager, user, enrollmentId, book, {
            choices: metadata.choices as AttendanceImportChoice[],
            updateExisting: metadata.updateExisting === true,
          });
          if (plan.errors.length || plan.snapshot !== metadata.snapshot)
            throw new ConflictException('Los datos cambiaron. Genera una nueva vista previa');
          const availability: { date: string; sessionId: number; created: boolean }[] = [];
          for (const column of plan.columns) {
            if (!column.date) throw new ConflictException('Fecha sin resolver');
            const sessionId =
              column.selected?.id ??
              (
                await this.attendance.createImportedManualSession(
                  user.idUser,
                  enrollmentId,
                  column.date,
                  manager,
                )
              ).idAttendanceSession;
            availability.push({ date: column.date, sessionId, created: column.create });
            const changes = plan.cells.filter(
              (cell) =>
                cell.column === column.column &&
                (cell.action === 'create' || cell.action === 'update'),
            );
            if (changes.length)
              await this.attendance.saveAttendances(
                user.idUser,
                sessionId,
                {
                  attendances: changes.map(({ enrollmentId: id, status }) => ({
                    enrollmentId: id,
                    status,
                  })),
                },
                undefined,
                manager,
              );
          }
          operation.metadata = { ...metadata, sessions: availability, result: plan.summary };
          return plan.summary;
        },
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === '40001' || error.code === '40P01' || error.code === '23505')
      )
        throw new ConflictException('Hubo una edición simultánea. Genera una nueva vista previa');
      throw error;
    }
  }
}
