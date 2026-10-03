import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { UnrecoverableError } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import {
  BulkOperationRowStatus as RowStatus,
  BulkOperationStatus as Status,
  BulkOperationType,
} from '@common/enums/bulk-operation';
import { userImportSettings } from '@core/config/bulk-import.config';
import { UserImportRowDto } from 'src/dtos/users/users-import.dto';
import type { UserImportPreviewRow } from 'src/dtos/users/users-import-preview.dto';
import { toUserImportPreviewRow } from './users-import-preview';
import {
  userImportRequiresRu,
  userImportUsername,
  validateUserImportRole,
} from './user-import-rules';
import { mapConcurrent } from './user-import-concurrency';

interface Candidate {
  row: BulkOperationRow;
  data: UserImportPreviewRow;
  errors: string[];
  hash?: string;
}

@Injectable()
export class UserImportProcessor {
  private readonly logger = new Logger(UserImportProcessor.name);
  private readonly settings: ReturnType<typeof userImportSettings>;
  constructor(
    private readonly source: DataSource,
    config: ConfigService,
  ) {
    this.settings = userImportSettings({
      BULK_USER_IMPORT_BATCH_SIZE: config.get<string>('BULK_USER_IMPORT_BATCH_SIZE'),
      BULK_USER_IMPORT_BCRYPT_CONCURRENCY: config.get<string>(
        'BULK_USER_IMPORT_BCRYPT_CONCURRENCY',
      ),
    });
  }

  async process(id: string): Promise<void> {
    const operation = await this.source
      .getRepository(BulkOperation)
      .findOne({ where: { idBulkOperation: id }, relations: { createdBy: true } });
    if (!operation || operation.type !== BulkOperationType.USER_IMPORT)
      throw new UnrecoverableError('Invalid USER_IMPORT operation');
    if ([Status.COMPLETED, Status.COMPLETED_WITH_ERRORS].includes(operation.status)) return;
    if (operation.status !== Status.IMPORTING)
      throw new UnrecoverableError('Operation is not IMPORTING');
    let roleName: string;
    try {
      const value = operation.metadata?.roleName;
      if (typeof value !== 'string') throw new Error();
      roleName = validateUserImportRole(value);
    } catch {
      throw new UnrecoverableError('Invalid USER_IMPORT role metadata');
    }
    const role = await this.source
      .getRepository(Role)
      .findOne({ where: { name: roleName, isActive: true } });
    if (!role) throw new UnrecoverableError('Import role is not available');
    for (;;) {
      const batch = await this.source
        .getRepository(BulkOperationRow)
        .createQueryBuilder('row')
        .where('row.id_bulk_operation = :id', { id })
        .andWhere('row.status = :status', { status: RowStatus.PENDING })
        .orderBy('row.rowNumber', 'ASC')
        .take(this.settings.batchSize)
        .getMany();
      if (!batch.length) {
        await this.finish(id);
        return;
      }
      const candidates = await Promise.all(batch.map((row) => this.validateRow(row, roleName)));
      // Set-based check before bcrypt; repeated within the write transaction to handle races.
      this.addBatchDuplicates(candidates);
      this.addConflicts(candidates, await this.conflicts(this.source.manager, candidates));
      await mapConcurrent(
        candidates.filter((item) => !item.errors.length),
        this.settings.bcryptConcurrency,
        async (item) => {
          item.hash = await bcrypt.hash(item.data.ci, 10);
        },
      );
      await this.commitBatch(id, operation.createdBy.idUser, role.idRole, roleName, candidates);
    }
  }

  private async validateRow(row: BulkOperationRow, role: string): Promise<Candidate> {
    let data: UserImportPreviewRow;
    try {
      data = toUserImportPreviewRow(row);
    } catch {
      return {
        row,
        data: {
          row: row.rowNumber,
          name: '',
          lastname: '',
          ci: '',
          ru: '',
          email: '',
          username: '',
          valid: false,
          errors: [],
        },
        errors: ['Datos de fila inválidos'],
      };
    }
    const errors: string[] = [];
    const validations = await validate(plainToInstance(UserImportRowDto, data));
    const messages: Record<string, string> = {
      name: 'Los nombres son obligatorios',
      lastname: 'Los apellidos son obligatorios',
      ci: 'El CI es obligatorio',
      email: 'El email no es válido',
    };
    for (const result of validations)
      errors.push(messages[result.property] ?? 'Datos de fila inválidos');
    if (!row.valid) errors.push('La fila no es válida para importar');
    if (userImportRequiresRu(role) && !data.ru)
      errors.push(`El RU es obligatorio para usuarios con rol ${role}`);
    if (data.username !== userImportUsername(role, data.ci, data.ru))
      errors.push('El username no corresponde al rol');
    return { row, data, errors };
  }

  private async conflicts(manager: EntityManager, items: Candidate[]): Promise<User[]> {
    if (!items.length) return [];
    const values = (field: 'ci' | 'ru' | 'email' | 'username') => [
      ...new Set(items.map((item) => item.data[field]).filter(Boolean)),
    ];
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .withDeleted()
      .select(['user.idUser', 'user.ci', 'user.ru', 'user.email', 'user.username'])
      .where(
        'user.ci = ANY(:cis) OR user.ru = ANY(:rus) OR LOWER(user.email) = ANY(:emails) OR user.username = ANY(:usernames)',
        {
          cis: values('ci'),
          rus: values('ru'),
          emails: values('email').map((email) => email.toLowerCase()),
          usernames: values('username'),
        },
      )
      .getMany();
  }

  private addConflicts(items: Candidate[], users: User[]) {
    const fields = ['ci', 'ru', 'email', 'username'] as const;
    for (const field of fields) {
      const existing = new Set(
        users
          .map((user) => (field === 'email' ? user.email.toLowerCase() : user[field]))
          .filter(Boolean),
      );
      for (const item of items)
        if (
          item.data[field] &&
          existing.has(field === 'email' ? item.data[field].toLowerCase() : item.data[field])
        ) {
          const message = `Ya existe un usuario con este ${field === 'ci' ? 'CI' : field === 'ru' ? 'RU' : field}`;
          if (!item.errors.includes(message)) item.errors.push(message);
        }
    }
  }

  private addBatchDuplicates(items: Candidate[]) {
    for (const field of ['ci', 'ru', 'email', 'username'] as const) {
      const counts = new Map<string, number>();
      for (const item of items) {
        const value = field === 'email' ? item.data[field].toLowerCase() : item.data[field];
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      for (const item of items) {
        const value = field === 'email' ? item.data[field].toLowerCase() : item.data[field];
        if (value && (counts.get(value) ?? 0) > 1)
          item.errors.push(`Valor ${field} duplicado en el lote`);
      }
    }
  }

  private async commitBatch(
    id: string,
    ownerId: number,
    roleId: number,
    roleName: string,
    candidates: Candidate[],
  ) {
    const progress = await this.source.transaction(async (manager) => {
      const operations = manager.getRepository(BulkOperation);
      const operation = await operations
        .createQueryBuilder('operation')
        .where('operation.idBulkOperation = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!operation || operation.status !== Status.IMPORTING)
        throw new UnrecoverableError('Operation cannot accept a batch');
      const activeRole = await manager.getRepository(Role).findOne({
        where: { idRole: roleId, name: roleName, isActive: true },
        lock: { mode: 'pessimistic_read' },
      });
      if (!activeRole) throw new UnrecoverableError('Import role is no longer available');
      const rows = manager.getRepository(BulkOperationRow);
      // Lock only the row table: no nullable relation joins in FOR UPDATE.
      const pending = await rows
        .createQueryBuilder('row')
        .where('row.id_bulk_operation = :id', { id })
        .andWhere('row.idBulkOperationRow IN (:...ids)', {
          ids: candidates.map((item) => item.row.idBulkOperationRow),
        })
        .andWhere('row.status = :status', { status: RowStatus.PENDING })
        .setLock('pessimistic_write')
        .getMany();
      const pendingIds = new Set(pending.map((row) => row.idBulkOperationRow));
      const current = candidates.filter((item) => pendingIds.has(item.row.idBulkOperationRow));
      this.addConflicts(current, await this.conflicts(manager, current));
      const eligible = current.filter((item) => !item.errors.length);
      const inserted = new Map<string, number>();
      if (eligible.length) {
        const result = await manager
          .getRepository(User)
          .createQueryBuilder()
          .insert()
          .values(
            eligible.map((item) => {
              if (!item.hash) throw new Error('Missing in-memory hash');
              return {
                name: item.data.name,
                lastname: item.data.lastname,
                ci: item.data.ci,
                ru: item.data.ru || undefined,
                email: item.data.email.toLowerCase(),
                username: item.data.username,
                password: item.hash,
                createdBy: ownerId,
              };
            }),
          )
          .orIgnore()
          .returning(['idUser', 'username'])
          .execute();
        const raw: unknown = result.raw;
        if (!Array.isArray(raw)) throw new Error('Invalid INSERT result');
        for (const entry of raw as unknown[]) {
          if (
            typeof entry !== 'object' ||
            !entry ||
            !('id_user' in entry) ||
            typeof entry.id_user !== 'number' ||
            !('username' in entry) ||
            typeof entry.username !== 'string'
          )
            throw new Error('Invalid INSERT projection');
          inserted.set(entry.username, entry.id_user);
        }
        if (inserted.size)
          await manager
            .createQueryBuilder()
            .relation(User, 'roles')
            .of([...inserted.values()])
            .add(roleId);
      }
      // Unique constraints also protect against another writer committing after revalidation.
      const missed = eligible.filter((item) => !inserted.has(item.data.username));
      this.addConflicts(missed, await this.conflicts(manager, missed));
      for (const item of current) {
        const success = !item.errors.length && inserted.has(item.data.username);
        item.row.status = success ? RowStatus.PROCESSED : RowStatus.FAILED;
        item.row.errors = success
          ? null
          : item.errors.length
            ? item.errors
            : ['Conflicto de unicidad durante la inserción'];
      }
      if (current.length)
        await rows.save(
          current.map((item) => item.row),
          { reload: false, chunk: this.settings.batchSize },
        );
      await this.recount(manager, operation);
      await operations.save(operation);
      return {
        processed: operation.processedRows,
        failed: operation.failedRows,
        total: operation.totalRows,
      };
    });
    this.logger.log(
      `USER_IMPORT batch committed operation=${id} processed=${progress.processed} failed=${progress.failed} total=${progress.total}`,
    );
  }

  private async recount(manager: EntityManager, operation: BulkOperation) {
    // Counts are reconstructed from durable terminal row states, including previous attempts.
    const rows = manager.getRepository(BulkOperationRow);
    operation.processedRows = await rows.countBy({
      operation: { idBulkOperation: operation.idBulkOperation },
      status: RowStatus.PROCESSED,
    });
    operation.failedRows = await rows.countBy({
      operation: { idBulkOperation: operation.idBulkOperation },
      status: RowStatus.FAILED,
    });
  }

  private async finish(id: string) {
    await this.source.transaction(async (manager) => {
      const repo = manager.getRepository(BulkOperation);
      const operation = await repo
        .createQueryBuilder('operation')
        .where('operation.idBulkOperation = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!operation || [Status.COMPLETED, Status.COMPLETED_WITH_ERRORS].includes(operation.status))
        return;
      if (operation.status !== Status.IMPORTING)
        throw new UnrecoverableError('Operation cannot finish');
      await this.recount(manager, operation);
      if (operation.processedRows + operation.failedRows !== operation.totalRows)
        throw new UnrecoverableError('Inconsistent durable row counts');
      operation.status = operation.failedRows ? Status.COMPLETED_WITH_ERRORS : Status.COMPLETED;
      operation.completedAt = new Date();
      await repo.save(operation);
    });
  }

  async markFailed(id: string) {
    await this.source
      .getRepository(BulkOperation)
      .update(
        { idBulkOperation: id, type: BulkOperationType.USER_IMPORT, status: Status.IMPORTING },
        { status: Status.FAILED, completedAt: new Date() },
      );
  }
}
