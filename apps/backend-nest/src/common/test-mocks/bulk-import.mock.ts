import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import type {
  CreateBulkOperationDto,
  CreateBulkOperationRowDto,
  UpdateBulkOperationDto,
  BulkOperationRowsQueryDto,
} from 'src/dtos/bulk-operations/bulk-operation.dto';

export function bulkImportMock(
  run: (work: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>,
) {
  const operations = new Map<string, BulkOperation>();
  const rows = new Map<string, BulkOperationRow[]>();
  const getById = jest.fn((id: string, ownerId: number) => {
    const operation = operations.get(id);
    if (!operation || operation.createdBy.idUser !== ownerId) throw new NotFoundException();
    return Promise.resolve(operation);
  });
  const bulk = {
    getById,
    create: jest.fn(
      (dto: CreateBulkOperationDto, ownerId: number, initial: CreateBulkOperationRowDto[] = []) => {
        const id = `00000000-0000-4000-8000-${String(operations.size + 1).padStart(12, '0')}`;
        const operation = Object.assign(new BulkOperation(), {
          idBulkOperation: id,
          type: dto.type,
          metadata: dto.metadata,
          createdBy: { idUser: ownerId },
          status: BulkOperationStatus.PENDING,
          totalRows: initial.length,
          validRows: initial.filter((row) => row.valid).length,
          invalidRows: initial.filter((row) => !row.valid).length,
          processedRows: 0,
          failedRows: 0,
        });
        operations.set(id, operation);
        rows.set(
          id,
          initial.map((row) =>
            Object.assign(new BulkOperationRow(), row, {
              rowNumber: row.rowNumber,
              errors: row.errors ?? [],
            }),
          ),
        );
        return Promise.resolve(operation);
      },
    ),
    update: jest.fn(async (id: string, ownerId: number, patch: UpdateBulkOperationDto) =>
      Object.assign(await getById(id, ownerId), patch),
    ),
    findRows: jest.fn(
      async (id: string, ownerId: number, query: BulkOperationRowsQueryDto = {}) => {
        await getById(id, ownerId);
        const all = (rows.get(id) ?? [])
          .filter((row) => query.valid === undefined || row.valid === query.valid)
          .sort((a, b) => a.rowNumber - b.rowNumber);
        const page = query.page ?? 1,
          limit = query.limit ?? 25;
        return {
          data: all.slice((page - 1) * limit, page * limit),
          meta: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) },
        };
      },
    ),
    executeReady: jest.fn(
      async (
        id: string,
        ownerId: number,
        type: BulkOperationType,
        work: (
          manager: EntityManager,
          operation: BulkOperation,
          rows: BulkOperationRow[],
        ) => Promise<unknown>,
      ) => {
        const operation = await getById(id, ownerId);
        if (operation.type !== type) throw new NotFoundException();
        if (operation.status !== BulkOperationStatus.READY) throw new ConflictException();
        if (operation.invalidRows) throw new BadRequestException();
        const result = await run((manager) => work(manager, operation, rows.get(id) ?? []));
        operation.status = BulkOperationStatus.COMPLETED;
        operation.processedRows = operation.totalRows;
        return result;
      },
    ),
  };
  return { bulk, operations, rows };
}
