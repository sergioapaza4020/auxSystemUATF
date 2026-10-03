import { DataSource, QueryRunner } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { User } from 'src/entities/users/users.entity';
import { AddBulkOperations1790926042143 } from 'src/database/migrations/1790926042143-AddBulkOperations';

class MetadataDataSource extends DataSource {
  async prepareMetadata() {
    await this.buildMetadatas();
  }
}

describe('Bulk operation PostgreSQL mapping', () => {
  const source = new MetadataDataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });

  beforeAll(async () => source.prepareMetadata());

  it('maps a generated UUID and mandatory User ownership without changing BaseEntity', () => {
    const metadata = source.getMetadata(BulkOperation);
    const id = metadata.primaryColumns[0];
    expect(id.databaseName).toBe('id_bulk_operation');
    expect(id.generationStrategy).toBe('uuid');
    const owner = metadata.relations.find((relation) => relation.propertyName === 'createdBy')!;
    expect(owner.inverseEntityMetadata.target).toBe(User);
    expect(owner.isNullable).toBe(false);
    expect(owner.joinColumns[0].databaseName).toBe('created_by');
    expect(owner.onDelete).toBe('RESTRICT');
  });

  it('enforces unique operation/row order, composite filters, cascade and JSONB', () => {
    const metadata = source.getMetadata(BulkOperationRow);
    expect(
      metadata.indices.map((index) => ({
        name: index.name,
        unique: index.isUnique,
        columns: index.columns.map((column) => column.databaseName),
      })),
    ).toEqual([
      {
        name: 'IDX_bulk_operation_rows_operation_status',
        unique: false,
        columns: ['id_bulk_operation', 'status'],
      },
      {
        name: 'IDX_bulk_operation_rows_operation_valid',
        unique: false,
        columns: ['id_bulk_operation', 'valid'],
      },
      {
        name: 'UQ_bulk_operation_rows_operation_row',
        unique: true,
        columns: ['id_bulk_operation', 'row_number'],
      },
    ]);
    expect(metadata.relations[0].onDelete).toBe('CASCADE');
    for (const property of ['data', 'errors']) {
      expect(metadata.columns.find((column) => column.propertyName === property)?.type).toBe(
        'jsonb',
      );
    }
    expect(metadata.checks.map((check) => check.name)).toContain(
      'CHK_bulk_operation_rows_row_number',
    );
  });

  it('generates PostgreSQL ordering, limit, offset and filters without fetching all rows', () => {
    const builder = source
      .getRepository(BulkOperationRow)
      .createQueryBuilder('row')
      .innerJoin('row.operation', 'operation')
      .where('operation.idBulkOperation = :id', { id: 'b73a79d0-02ca-4a3a-8a47-5516cae13e47' })
      .andWhere('operation.created_by = :owner', { owner: 17 })
      .andWhere('row.valid = :valid', { valid: false })
      .orderBy('row.rowNumber', 'ASC')
      .limit(20)
      .offset(20);
    const [sql, parameters] = builder.getQueryAndParameters();
    expect(sql).toContain('ORDER BY "row"."row_number" ASC LIMIT 20 OFFSET 20');
    expect(sql).toContain('"row"."valid" = $3');
    expect(parameters).toEqual(['b73a79d0-02ca-4a3a-8a47-5516cae13e47', 17, false]);
  });

  it('generates a single multi-row INSERT with parameterized JSONB', () => {
    const [sql, parameters] = source
      .getRepository(BulkOperationRow)
      .createQueryBuilder()
      .insert()
      .values([
        {
          operation: { idBulkOperation: 'b73a79d0-02ca-4a3a-8a47-5516cae13e47' },
          rowNumber: 1,
          valid: true,
          data: () => ':data0',
          errors: () => ':errors0',
        },
        {
          operation: { idBulkOperation: 'b73a79d0-02ca-4a3a-8a47-5516cae13e47' },
          rowNumber: 2,
          valid: false,
          data: () => ':data1',
          errors: () => ':errors1',
        },
      ])
      .setParameters({
        data0: '{"name":"Carlos"}',
        errors0: null,
        data1: '{"ru":"1"}',
        errors1: '["RU duplicado"]',
      })
      .getQueryAndParameters();
    expect(sql.match(/INSERT INTO/g)).toHaveLength(1);
    expect(sql).toContain('), (');
    expect(parameters).toContain('{"name":"Carlos"}');
    expect(parameters).toContain('["RU duplicado"]');
    expect(parameters).toContain(null);
  });

  it('migration covers entity constraints and indexes, and reverses tables/enums in dependency order', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn((sql: string) => {
        statements.push(sql);
        return Promise.resolve();
      }),
    };
    const migration = new AddBulkOperations1790926042143();
    await migration.up(runner as unknown as QueryRunner);
    const sql = statements.join('\n');
    for (const entity of [BulkOperation, BulkOperationRow]) {
      const metadata = source.getMetadata(entity);
      expect(sql).toContain(`CREATE TABLE "${metadata.tableName}"`);
      for (const index of metadata.indices) expect(sql).toContain(`"${index.name}"`);
      for (const check of metadata.checks)
        expect(sql).toContain(`"${check.name}" CHECK (${check.expression})`);
      for (const column of metadata.columns) expect(sql).toContain(`"${column.databaseName}"`);
      for (const key of metadata.foreignKeys) expect(sql).toContain(`"${key.name}" FOREIGN KEY`);
    }
    expect(sql).toContain('DEFAULT uuid_generate_v4()');
    statements.length = 0;
    await migration.down(runner as unknown as QueryRunner);
    expect(statements).toEqual([
      'DROP TABLE "bulk_operation_rows"',
      'DROP TABLE "bulk_operations"',
      'DROP TYPE "public"."bulk_operation_rows_status_enum"',
      'DROP TYPE "public"."bulk_operations_status_enum"',
      'DROP TYPE "public"."bulk_operations_type_enum"',
    ]);
  });
});
