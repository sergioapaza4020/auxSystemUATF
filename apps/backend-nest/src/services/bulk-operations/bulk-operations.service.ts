import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import type {
  BulkOperationRowsQueryDto,
  CreateBulkOperationDto,
  CreateBulkOperationRowDto,
  JsonValue,
  UpdateBulkOperationDto,
} from 'src/dtos/bulk-operations/bulk-operation.dto';

export const BULK_OPERATION_ROW_CHUNK_SIZE = 500;

@Injectable()
export class BulkOperationsService {
  constructor(
    @InjectRepository(BulkOperation)
    private readonly operations: Repository<BulkOperation>,
    @InjectRepository(BulkOperationRow)
    private readonly rows: Repository<BulkOperationRow>,
  ) {}

  /** Optional initial rows and their counters are committed together with the operation. */
  async create(
    dto: CreateBulkOperationDto,
    ownerId: number,
    rows: CreateBulkOperationRowDto[] = [],
  ) {
    this.validateOwner(ownerId);
    if (!Object.values(BulkOperationType).includes(dto.type)) {
      throw new BadRequestException('Invalid bulk operation type');
    }
    this.validateJson(dto.metadata ?? null);
    this.validateDate(dto.expiresAt);
    this.validateRows(rows);
    return this.operations.manager.transaction(async (manager) => {
      const repository = manager.getRepository(BulkOperation);
      const operation = await repository.save(
        repository.create({
          type: dto.type,
          createdBy: { idUser: ownerId },
          metadata: dto.metadata ?? null,
          expiresAt: dto.expiresAt ?? null,
          totalRows: rows.length,
          validRows: rows.filter((row) => row.valid).length,
          invalidRows: rows.filter((row) => !row.valid).length,
          processedRows: 0,
          failedRows: 0,
          status: BulkOperationStatus.PENDING,
        }),
      );
      await this.insertRows(manager, operation.idBulkOperation, rows);
      return operation;
    });
  }

  async getById(operationId: string, ownerId: number) {
    this.validateIdentity(operationId, ownerId);
    const operation = await this.operations.findOne({
      where: { idBulkOperation: operationId, createdBy: { idUser: ownerId } },
      relations: { createdBy: true },
    });
    if (!operation) throw new NotFoundException('Bulk operation not found');
    return operation;
  }

  /** Counts reflect persisted rows, rather than caller-provided preview totals. */
  async saveRows(operationId: string, ownerId: number, rows: CreateBulkOperationRowDto[]) {
    this.validateIdentity(operationId, ownerId);
    this.validateRows(rows);
    return this.operations.manager.transaction(async (manager) => {
      const operation = await this.lockOperation(manager, operationId, ownerId);
      if (
        ![BulkOperationStatus.PENDING, BulkOperationStatus.PROCESSING].includes(operation.status)
      ) {
        throw new BadRequestException(
          'Rows can only be added to a pending or processing operation',
        );
      }
      await this.insertRows(manager, operationId, rows);
      operation.totalRows += rows.length;
      operation.validRows += rows.filter((row) => row.valid).length;
      operation.invalidRows += rows.filter((row) => !row.valid).length;
      return manager.getRepository(BulkOperation).save(operation);
    });
  }

  /** Successful and failed processing counts are disjoint, absolute counts. */
  async update(operationId: string, ownerId: number, dto: UpdateBulkOperationDto) {
    this.validateIdentity(operationId, ownerId);
    this.validateDate(dto.startedAt);
    this.validateDate(dto.completedAt);
    if (dto.status !== undefined && !Object.values(BulkOperationStatus).includes(dto.status)) {
      throw new BadRequestException('Invalid bulk operation status');
    }
    return this.operations.manager.transaction(async (manager) => {
      const operation = await this.lockOperation(manager, operationId, ownerId);
      const processed = dto.processedRows ?? operation.processedRows;
      const failed = dto.failedRows ?? operation.failedRows;
      if (
        ![processed, failed].every((count) => Number.isSafeInteger(count) && count >= 0) ||
        processed + failed > operation.totalRows
      ) {
        throw new BadRequestException('Invalid bulk operation counters');
      }
      operation.processedRows = processed;
      operation.failedRows = failed;
      if (dto.status !== undefined) operation.status = dto.status;
      if (dto.startedAt !== undefined) operation.startedAt = dto.startedAt;
      if (dto.completedAt !== undefined) operation.completedAt = dto.completedAt;
      return manager.getRepository(BulkOperation).save(operation);
    });
  }

  async findRows(
    operationId: string,
    ownerId: number,
    query: BulkOperationRowsQueryDto = {},
    condition?: Brackets,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset)
    ) {
      throw new BadRequestException('Invalid pagination: page >= 1, limit between 1 and 100');
    }
    if (query.valid !== undefined && typeof query.valid !== 'boolean') {
      throw new BadRequestException('Invalid valid filter');
    }
    await this.getById(operationId, ownerId);
    const builder = this.rows
      .createQueryBuilder('row')
      .innerJoin('row.operation', 'operation')
      .where('operation.idBulkOperation = :operationId', { operationId })
      .andWhere('operation.created_by = :ownerId', { ownerId });
    if (query.valid !== undefined) builder.andWhere('row.valid = :valid', { valid: query.valid });
    // Domain conditions can only narrow the owner-scoped query, not replace it.
    if (condition) builder.andWhere(condition);
    const [data, total] = await builder
      .orderBy('row.rowNumber', 'ASC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async lockOperation(manager: EntityManager, operationId: string, ownerId: number) {
    const operation = await manager
      .getRepository(BulkOperation)
      .createQueryBuilder('operation')
      .where('operation.idBulkOperation = :operationId', { operationId })
      .andWhere('operation.created_by = :ownerId', { ownerId })
      .setLock('pessimistic_write')
      .getOne();
    if (!operation) throw new NotFoundException('Bulk operation not found');
    return operation;
  }

  private async insertRows(
    manager: EntityManager,
    operationId: string,
    rows: CreateBulkOperationRowDto[],
  ) {
    for (let offset = 0; offset < rows.length; offset += BULK_OPERATION_ROW_CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + BULK_OPERATION_ROW_CHUNK_SIZE);
      const parameters: Record<string, string | null> = {};
      // Parameterized JSON avoids TypeORM's recursive DeepPartial conversion of JSON objects.
      const values = chunk.map((row, index) => {
        parameters[`data${index}`] = JSON.stringify(row.data);
        parameters[`errors${index}`] = row.errors ? JSON.stringify(row.errors) : null;
        return {
          operation: { idBulkOperation: operationId },
          rowNumber: row.rowNumber,
          valid: row.valid,
          data: () => `:data${index}`,
          errors: () => `:errors${index}`,
        };
      });
      await manager
        .getRepository(BulkOperationRow)
        .createQueryBuilder()
        .insert()
        .values(values)
        .setParameters(parameters)
        .execute();
    }
  }

  private validateOwner(ownerId: number) {
    if (!Number.isSafeInteger(ownerId) || ownerId < 1)
      throw new BadRequestException('Invalid owner');
  }

  private validateIdentity(operationId: string, ownerId: number) {
    this.validateOwner(ownerId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
      throw new BadRequestException('Invalid bulk operation ID');
    }
  }

  private validateDate(value: Date | undefined) {
    if (value !== undefined && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) {
      throw new BadRequestException('Invalid bulk operation date');
    }
  }

  private validateRows(rows: CreateBulkOperationRowDto[]) {
    const numbers = new Set<number>();
    for (const row of rows) {
      if (
        !Number.isInteger(row.rowNumber) ||
        row.rowNumber < 1 ||
        row.rowNumber > 2147483647 ||
        numbers.has(row.rowNumber) ||
        typeof row.valid !== 'boolean'
      ) {
        throw new BadRequestException('Invalid or duplicate row number / validity');
      }
      numbers.add(row.rowNumber);
      if (!row.data || Array.isArray(row.data) || typeof row.data !== 'object') {
        throw new BadRequestException('Row data must be a JSON object');
      }
      if (
        row.errors !== undefined &&
        (!Array.isArray(row.errors) || !row.errors.every((error) => typeof error === 'string'))
      ) {
        throw new BadRequestException('Row errors must be an array of strings');
      }
      this.validateJson(row.data);
    }
  }

  private validateJson(value: JsonValue, ancestors = new Set<object>()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || ancestors.has(value))
      throw new BadRequestException('Invalid JSON payload');
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new BadRequestException('Invalid JSON payload');
    }
    ancestors.add(value);
    for (const [key, nested] of Object.entries(value)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (
        /password|passwd|pwd|hash|token|secret|apikey|authorization|credential/.test(normalized)
      ) {
        throw new BadRequestException('Sensitive fields are not allowed in bulk operation JSON');
      }
      this.validateJson(nested, ancestors);
    }
    ancestors.delete(value);
  }
}
