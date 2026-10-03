import { InternalServerErrorException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import type { UserImportPreviewRow } from 'src/dtos/users/users-import-preview.dto';
import type { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';

/** USER_IMPORT-specific SQL; field names are fixed in code, the search is a parameter. */
export function userImportSearchCondition(search?: string): Brackets | undefined {
  const term = search?.trim();
  if (!term) return undefined;
  const parameter = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  return new Brackets((query) => {
    for (const field of ['name', 'lastname', 'ci', 'ru', 'email', 'username']) {
      query.orWhere(`row.data ->> '${field}' ILIKE :userImportSearch ESCAPE '\\'`, {
        userImportSearch: parameter,
      });
    }
    query.orWhere(
      `concat_ws(' ', row.data ->> 'name', row.data ->> 'lastname') ILIKE :userImportSearch ESCAPE '\\'`,
      { userImportSearch: parameter },
    );
  });
}

export function toUserImportPreviewRow(row: BulkOperationRow): UserImportPreviewRow {
  const text = (field: string): string => {
    const value = row.data[field];
    if (typeof value !== 'string')
      throw new InternalServerErrorException('Invalid USER_IMPORT preview data');
    return value;
  };
  return {
    row: row.rowNumber,
    name: text('name'),
    lastname: text('lastname'),
    ci: text('ci'),
    ru: text('ru'),
    email: text('email'),
    username: text('username'),
    valid: row.valid,
    errors: row.errors ?? [],
  };
}
