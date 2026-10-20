import { Brackets } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import type { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';

export function studentImportSearchCondition(search?: string, includeCareer = false) {
  if (!search?.trim()) return undefined;
  const term = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
  return new Brackets((query) => {
    for (const field of ['fullName', 'ru', 'username', 'email'])
      query.orWhere(`row.data ->> '${field}' ILIKE :studentImportSearch ESCAPE '\\'`, {
        studentImportSearch: term,
      });
    if (includeCareer)
      query.orWhere(
        `row.data -> 'currentCareer' ->> 'name' ILIKE :studentImportSearch ESCAPE '\\'`,
        { studentImportSearch: term },
      );
  });
}

export function studentImportPreviewRow(row: BulkOperationRow) {
  const nullableText = (key: string) => {
    const value = row.data[key];
    if (value !== null && typeof value !== 'string')
      throw new InternalServerErrorException('Invalid student import preview data');
    return value;
  };
  const studentId = row.data.studentId;
  if (
    studentId !== null &&
    (typeof studentId !== 'number' || !Number.isSafeInteger(studentId) || studentId < 1)
  )
    throw new InternalServerErrorException('Invalid student import preview student');
  const ru = nullableText('ru');
  if (ru === null) throw new InternalServerErrorException('Invalid student import RU');
  return {
    row: row.rowNumber,
    studentId,
    ru,
    fullName: nullableText('fullName'),
    username: nullableText('username'),
    email: nullableText('email'),
    status: row.valid ? ('VALID' as const) : ('INVALID' as const),
    errors: row.errors ?? [],
  };
}
