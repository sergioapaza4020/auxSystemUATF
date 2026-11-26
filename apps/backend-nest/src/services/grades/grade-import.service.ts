import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseRelations } from '@common/enums/courseRelations';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { activeCriteria, isAttendanceCriterion } from '@repo/grade-calculations';
import { assistantGradeItemLabel } from '@repo/grade-calculations/assistant-grade-items';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { Activity } from 'src/entities/activities/activity.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { ActivitiesService } from '../activities/activities.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { GradesService } from './grades.service';
import {
  gradeWorkbook,
  normalizeActivityName,
  readGradeWorkbook,
  similarActivity,
} from './grade-import-excel';

type Workbook = Awaited<ReturnType<typeof readGradeWorkbook>>;
export type ColumnChoice = {
  column: string;
  activityId?: number;
  detailId?: number;
  acceptDate?: boolean;
};
type Options = { choices: ColumnChoice[]; updateExisting: boolean };

const can = (user: JwtPayload, permission: string) =>
  user.roles.includes('SUPERADMIN') || user.permissions.includes(permission);

@Injectable()
export class GradeImportService {
  constructor(
    private readonly database: DataSource,
    private readonly enrollments: EnrollmentsService,
    private readonly operations: BulkOperationsService,
    private readonly activities: ActivitiesService,
    private readonly grades: GradesService,
  ) {}

  private async context(manager: EntityManager, user: JwtPayload, enrollmentId: number) {
    if (!can(user, 'grade.create'))
      throw new ForbiddenException('Se requiere permiso para importar calificaciones');
    const assistant = await this.enrollments.getAssistantEnrollment(
      user.idUser,
      enrollmentId,
      manager,
    );
    const courseId = assistant.course.idCourse;
    const semesterId = assistant.semester.idSemester;
    const scheme = await manager.getRepository(GradeScheme).findOne({
      where: { assistantEnrollment: { idEnrollment: enrollmentId }, isActive: true },
      relations: { details: { gradeItem: true } },
    });
    if (!scheme)
      throw new NotFoundException('Configura primero el esquema de evaluación del auxiliar');
    const criteria = activeCriteria(scheme.details)
      .filter(
        ({ gradeItem }) =>
          !isAttendanceCriterion(gradeItem.name) &&
          assistantGradeItemLabel(gradeItem.name) !== 'Asistencia',
      )
      .map((detail) => ({ id: detail.idGradeSchemeDetail, name: detail.gradeItem.name }));
    const [activities, students]: [Activity[], Enrollment[]] = await Promise.all([
      criteria.length
        ? manager.getRepository(Activity).find({
            where: {
              isActive: true,
              deletedAt: IsNull(),
              gradeSchemeDetail: { idGradeSchemeDetail: In(criteria.map((item) => item.id)) },
            },
            relations: { gradeSchemeDetail: true },
            order: { idActivity: 'ASC' },
          })
        : [],
      manager.getRepository(Enrollment).find({
        where: {
          isActive: true,
          role: CourseRelations.STUDENT,
          course: { idCourse: courseId },
          semester: { idSemester: semesterId },
        },
        relations: { user: true },
        order: { idEnrollment: 'ASC' },
      }),
    ]);
    return {
      courseId,
      semesterId,
      criteria,
      students,
      activities: activities.map((item) => ({
        id: item.idActivity,
        name: item.name,
        dueDate: item.dueDate,
        detailId: item.gradeSchemeDetail.idGradeSchemeDetail,
      })),
    };
  }

  async template(user: JwtPayload, enrollmentId: number) {
    const { students, activities } = await this.context(this.database.manager, user, enrollmentId);
    return gradeWorkbook(
      students.flatMap((student) => (student.user.ru ? [student.user.ru] : [])),
      activities,
    );
  }

  private async plan(
    manager: EntityManager,
    user: JwtPayload,
    enrollmentId: number,
    workbook: Workbook,
    options: Options,
  ) {
    const context = await this.context(manager, user, enrollmentId);
    const canCreate = can(user, 'activity.create');
    const canUpdate = can(user, 'grade.update');
    const errors: {
      row: number;
      column: string;
      ru?: string;
      activity?: string;
      message: string;
    }[] = [];
    const warnings: string[] = [];
    const courseNames = options.choices.some((choice) => choice.detailId !== undefined)
      ? new Set(
          (await this.activities.listActiveNames(context.courseId, manager)).map(({ name }) =>
            normalizeActivityName(name),
          ),
        )
      : new Set<string>();
    if (options.updateExisting && !canUpdate)
      throw new ForbiddenException('Se requiere permiso para actualizar notas');
    const keys = new Map<string, string>();
    const columns = workbook.columns.map((column) => {
      const choice = options.choices.find((item) => item.column === column.column);
      const name = normalizeActivityName(column.name);
      const exact = context.activities.filter((item) => normalizeActivityName(item.name) === name);
      const suggestions = context.activities
        .filter((item) => similarActivity(column.name, item.name))
        .map((item) => ({
          ...item,
          exact: exact.includes(item),
          reason: exact.includes(item)
            ? 'Nombre normalizado idéntico'
            : 'Variante numérica o diferencia de un carácter',
        }));
      const activity =
        choice?.activityId !== undefined
          ? context.activities.find((item) => item.id === choice.activityId)
          : choice?.detailId === undefined && exact.length === 1
            ? exact[0]
            : undefined;
      const detail = context.criteria.find((item) => item.id === choice?.detailId);
      const fail = (row: number, message: string) =>
        errors.push({ row, column: column.column, activity: column.name, message });
      if (!name || column.name.length > 255)
        fail(1, 'Escribe un nombre de actividad de 1 a 255 caracteres');
      if (!column.dueDate) fail(2, 'Escribe una fecha límite válida en formato dd/mm/aaaa');
      if (choice?.detailId !== undefined) {
        if (!canCreate) fail(1, 'Falta el permiso para crear actividades');
        if (!detail) fail(1, 'Selecciona un criterio evaluable activo');
        if (courseNames.has(name))
          fail(
            1,
            exact.length
              ? 'Ya existe una actividad con este nombre. Selecciona la actividad existente'
              : 'El nombre está ocupado por otra actividad de la materia. Usa un nombre distinto en Excel',
          );
      } else if (!activity) {
        fail(
          1,
          exact.length > 1
            ? 'Hay varias coincidencias exactas. Selecciona una actividad'
            : 'Selecciona una actividad o configura una nueva',
        );
      }
      if (activity && column.dueDate && activity.dueDate !== column.dueDate) {
        warnings.push(
          `Columna ${column.column}: Excel ${column.dueDate}, fecha vigente ${activity.dueDate}`,
        );
        if (!choice?.acceptDate) fail(2, 'Confirma que deseas conservar la fecha vigente');
      }
      const key = activity ? `activity:${activity.id}` : `name:${name}`;
      const previous = keys.get(key);
      if (previous) fail(1, `Actividad duplicada en las columnas ${previous} y ${column.column}`);
      else keys.set(key, column.column);
      return {
        ...column,
        activity,
        detail,
        suggestions,
        automaticActivityId: exact.length === 1 ? exact[0].id : null,
      };
    });

    const studentsByRu = new Map<string, number[]>();
    for (const student of context.students) {
      const ru = student.user.ru?.trim();
      if (ru) studentsByRu.set(ru, [...(studentsByRu.get(ru) ?? []), student.idEnrollment]);
    }
    const ruCounts = new Map<string, number>();
    for (const row of workbook.rows) ruCounts.set(row.ru, (ruCounts.get(row.ru) ?? 0) + 1);
    const ids = columns.flatMap((column) => (column.activity ? [column.activity.id] : []));
    const enrollmentIds = workbook.rows.flatMap((row) => studentsByRu.get(row.ru) ?? []);
    const stored =
      ids.length && enrollmentIds.length
        ? await manager.getRepository(Grade).find({
            where: {
              activity: { idActivity: In(ids) },
              enrollment: { idEnrollment: In(enrollmentIds) },
            },
            relations: { activity: true, enrollment: true },
          })
        : [];
    const previousScores = new Map(
      stored.map((item) => [
        `${item.enrollment.idEnrollment}:${item.activity?.idActivity}`,
        Number(item.score),
      ]),
    );
    const cells: {
      row: number;
      ru: string;
      enrollmentId: number;
      column: string;
      activity: string;
      score: number;
      previous: number | null;
    }[] = [];
    let empty = 0;
    let identified = 0;
    for (const row of workbook.rows) {
      const students = studentsByRu.get(row.ru) ?? [];
      if (!row.ru || students.length !== 1 || (ruCounts.get(row.ru) ?? 0) > 1) {
        errors.push({
          row: row.row,
          column: 'A',
          ru: row.ru,
          message: !row.ru
            ? 'Escribe el RU del estudiante'
            : (ruCounts.get(row.ru) ?? 0) > 1
              ? 'RU duplicado en el archivo. Consolida las filas'
              : 'Comprueba que el RU tenga una única matrícula activa en esta materia y semestre',
        });
      } else identified++;
      row.scores.forEach((score, index) => {
        if (score === null) {
          empty++;
          return;
        }
        const column = columns[index];
        if (
          typeof score !== 'number' ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > 100 ||
          Math.abs(score * 100 - Math.round(score * 100)) > 1e-9
        ) {
          errors.push({
            row: row.row,
            column: column.column,
            ru: row.ru,
            activity: column.name,
            message: 'Ingresa una nota entre 0 y 100 con hasta dos decimales',
          });
        } else if (
          students.length === 1 &&
          (ruCounts.get(row.ru) ?? 0) === 1 &&
          (column.activity || column.detail)
        ) {
          cells.push({
            row: row.row,
            ru: row.ru,
            enrollmentId: students[0],
            column: column.column,
            activity: column.activity?.name ?? column.name,
            score,
            previous: previousScores.get(`${students[0]}:${column.activity?.id}`) ?? null,
          });
        }
      });
    }
    const conflicts = cells.filter((cell) => cell.previous !== null);
    const summary = {
      identified,
      existingActivities: columns.filter((column) => column.activity).length,
      newActivities: columns.filter((column) => column.detail).length,
      similar: columns.filter((column) =>
        column.suggestions.some(
          (item) => normalizeActivityName(item.name) !== normalizeActivityName(column.name),
        ),
      ).length,
      created: cells.length - conflicts.length,
      updated: options.updateExisting ? conflicts.length : 0,
      skipped: options.updateExisting ? 0 : conflicts.length,
      empty,
      errors: errors.length,
      warnings: warnings.length,
    };
    const snapshot = createHash('sha256')
      .update(
        JSON.stringify({
          courseId: context.courseId,
          semesterId: context.semesterId,
          mappings: columns.map(({ column, activity, detail }) => ({ column, activity, detail })),
          cells,
        }),
      )
      .digest('hex');
    return {
      columns,
      choices: context.activities,
      criteria: context.criteria,
      canCreate,
      canUpdate,
      summary,
      errors,
      warnings,
      conflicts,
      cells,
      snapshot,
      courseId: context.courseId,
      semesterId: context.semesterId,
    };
  }

  async preview(
    user: JwtPayload,
    enrollmentId: number,
    file: Express.Multer.File | undefined,
    options: Options,
  ) {
    const workbook = await readGradeWorkbook(file);
    const { cells, snapshot, ...preview } = await this.database.transaction(
      'REPEATABLE READ',
      (manager) => this.plan(manager, user, enrollmentId, workbook, options),
    );
    let operationId: string | null = null;
    if (!preview.errors.length && cells.length) {
      const operation = await this.operations.create(
        {
          type: BulkOperationType.GRADE_IMPORT,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          metadata: {
            enrollmentId,
            courseId: preview.courseId,
            semesterId: preview.semesterId,
            filename: file?.originalname ?? '',
            bytes: file?.size ?? 0,
            columns: workbook.columns,
            choices: options.choices.map((choice) => ({
              column: choice.column,
              activityId: choice.activityId ?? null,
              detailId: choice.detailId ?? null,
              acceptDate: choice.acceptDate ?? false,
            })),
            updateExisting: options.updateExisting,
            snapshot,
          },
        },
        user.idUser,
        workbook.rows.map(({ row, ...data }) => ({ rowNumber: row, data, valid: true })),
      );
      operationId = operation.idBulkOperation;
      await this.operations.update(operationId, user.idUser, { status: BulkOperationStatus.READY });
    }
    return { ...preview, operationId };
  }

  async confirm(user: JwtPayload, enrollmentId: number, operationId: string) {
    try {
      await this.context(this.database.manager, user, enrollmentId);
      const stored = await this.operations.getById(operationId, user.idUser);
      if (
        stored.type !== BulkOperationType.GRADE_IMPORT ||
        stored.metadata?.enrollmentId !== enrollmentId
      )
        throw new NotFoundException('Operación fuera del contexto de la materia');
      if (stored.status === BulkOperationStatus.COMPLETED) return stored.metadata.result;
      return await this.operations.executeReady(
        operationId,
        user.idUser,
        BulkOperationType.GRADE_IMPORT,
        async (manager, operation, rows) => {
          const metadata = operation.metadata;
          if (!metadata || metadata.enrollmentId !== enrollmentId)
            throw new NotFoundException('Operación fuera del contexto de la materia');
          await manager.getRepository(Course).findOneOrFail({
            where: { idCourse: Number(metadata.courseId) },
            lock: { mode: 'pessimistic_write' },
          });
          const workbook: Workbook = {
            columns: metadata.columns as Workbook['columns'],
            rows: rows.map(({ rowNumber, data }) => ({
              row: rowNumber,
              ru: typeof data.ru === 'string' ? data.ru : '',
              scores: data.scores as Workbook['rows'][number]['scores'],
            })),
          };
          const updateExisting = metadata.updateExisting === true;
          const choices = (
            metadata.choices as (Omit<ColumnChoice, 'activityId' | 'detailId'> & {
              activityId: number | null;
              detailId: number | null;
            })[]
          ).map((choice) => ({
            ...choice,
            activityId: choice.activityId ?? undefined,
            detailId: choice.detailId ?? undefined,
          }));
          const plan = await this.plan(manager, user, enrollmentId, workbook, {
            choices,
            updateExisting,
          });
          if (plan.errors.length || plan.snapshot !== metadata.snapshot)
            throw new ConflictException({
              message: 'Los datos cambiaron. Genera una nueva vista previa',
              errors: plan.errors,
            });
          const activityIds = new Map<string, number>();
          for (const column of plan.columns) {
            if (column.activity) activityIds.set(column.column, column.activity.id);
            else if (column.detail && column.dueDate) {
              const activity = await this.activities.create(
                plan.courseId,
                user.idUser,
                {
                  name: column.name,
                  dueDate: column.dueDate,
                  gradeSchemeDetailId: column.detail.id,
                },
                { manager, enrollmentId },
              );
              activityIds.set(column.column, activity.idActivity);
            }
          }
          const changes = plan.cells.filter((cell) => updateExisting || cell.previous === null);
          for (let offset = 0; offset < changes.length; offset += 500) {
            const grades = changes.slice(offset, offset + 500).map((cell) => {
              const activityId = activityIds.get(cell.column);
              if (activityId === undefined) throw new ConflictException('Actividad sin resolver');
              return { activityId, enrollmentId: cell.enrollmentId, score: cell.score };
            });
            const result = await this.grades.saveBulk(
              user,
              enrollmentId,
              { grades },
              { manager, updateExisting },
            );
            if (result.grades.length !== grades.length)
              throw new ConflictException('Las notas cambiaron. Revisa el archivo otra vez');
          }
          operation.metadata = {
            ...metadata,
            result: plan.summary,
            activities: Array.from(activityIds, ([column, activityId]) => ({ column, activityId })),
            changes: changes.map(({ enrollmentId, column, score, previous }) => ({
              enrollmentId,
              column,
              score,
              previous,
            })),
          };
          return plan.summary;
        },
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === '40001' || error.code === '40P01')
      )
        throw new ConflictException('Hubo una edición simultánea. Genera una nueva vista previa');
      throw error;
    }
  }
}
