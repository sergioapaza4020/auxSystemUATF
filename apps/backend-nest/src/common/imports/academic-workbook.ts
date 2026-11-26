import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import * as Excel from 'exceljs';
import { STUDENT_RU_IMPORT_MAX_BYTES } from '@common/imports/student-ru-import';

export function parseWorkbookDate(value: Excel.CellValue): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return parseWorkbookDate(value.toISOString().slice(0, 10).split('-').reverse().join('/'));
  }
  if (typeof value !== 'string') return null;
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!parts) return null;
  const iso = `${parts[3]}-${parts[2]}-${parts[1]}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return parts[3] !== '0000' &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

export async function loadImportWorkbook(file?: Express.Multer.File) {
  if (!file || !/\.xlsx$/i.test(file.originalname))
    throw new BadRequestException('Selecciona un archivo .xlsx');
  if (file.buffer.length > STUDENT_RU_IMPORT_MAX_BYTES)
    throw new PayloadTooLargeException('El archivo no debe superar los 5 MB');
  const workbook = new Excel.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(file.buffer).buffer);
  } catch {
    throw new BadRequestException('El archivo Excel está dañado o su formato es inválido');
  }
  return workbook;
}

export function readWorkbookRu(cell: Excel.Cell): string {
  const ru = cell.value;
  if (typeof ru === 'string') return ru.trim();
  return typeof ru === 'number' && Number.isSafeInteger(ru) && ru >= 0
    ? String(ru).padStart(/^0{1,32}$/.test(cell.numFmt) ? cell.numFmt.length : 0, '0')
    : '';
}
