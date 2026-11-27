import { BadRequestException } from '@nestjs/common';
import * as Excel from 'exceljs';
import {
  loadImportWorkbook,
  parseWorkbookDate as deadline,
  readWorkbookRu,
} from '@common/imports/academic-workbook';

export { deadline };
export const normalizeActivityName = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function similarityKey(name: string) {
  return normalizeActivityName(name)
    .replace(/\bn\s*\.?\s*[º°]\s*(?=\d)/g, '')
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, ''))
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function similarActivity(left: string, right: string) {
  const a = similarityKey(left);
  const b = similarityKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.match(/\d+/g)?.join(',') !== b.match(/\d+/g)?.join(',')) return false;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  return a.length === b.length
    ? a.slice(i + 1) === b.slice(i + 1)
    : a.length > b.length
      ? a.slice(i + 1) === b.slice(i)
      : a.slice(i) === b.slice(i + 1);
}

export async function readGradeWorkbook(file?: Express.Multer.File) {
  const workbook = await loadImportWorkbook(file);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.getCell('A1').value !== 'RU' || sheet.columnCount < 2)
    throw new BadRequestException('Escribe RU en A1 y las actividades a partir de B1');
  if (
    sheet.columnCount > 101 ||
    sheet.rowCount > 2002 ||
    sheet.columnCount * sheet.rowCount > 25000
  )
    throw new BadRequestException(
      'Reduce el archivo a 100 actividades, 2000 estudiantes y 25 000 celdas',
    );
  const columns = Array.from({ length: sheet.columnCount - 1 }, (_, index) => {
    const cell = sheet.getCell(1, index + 2);
    return {
      column: cell.address.replace(/\d+$/, ''),
      name: typeof cell.value === 'string' ? cell.value.trim() : '',
      dueDate: deadline(sheet.getCell(2, index + 2).value),
    };
  });
  const rows: { row: number; ru: string; scores: (number | string | null)[] }[] = [];
  sheet.eachRow((row, number) => {
    if (number < 3) return;
    rows.push({
      row: number,
      ru: readWorkbookRu(row.getCell(1)),
      scores: columns.map((_, index) => {
        const cell = row.getCell(index + 2).value;
        if (cell == null || (typeof cell === 'string' && !cell.trim())) return null;
        if (typeof cell === 'number') return cell;
        if (typeof cell === 'string' && /^\d+(?:\.\d+)?$/.test(cell.trim())) return Number(cell);
        return 'inválida';
      }),
    });
  });
  if (!rows.length || !rows.some((row) => row.scores.some((score) => score !== null)))
    throw new BadRequestException('El archivo no contiene calificaciones para importar');
  return { columns, rows };
}

export async function gradeWorkbook(
  rus: string[],
  activities: { name: string; dueDate: string }[],
) {
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('Calificaciones');
  sheet.getColumn(1).width = 18;
  sheet.getColumn(1).numFmt = '@';
  sheet.getCell('A1').value = 'RU';
  activities.forEach((activity, index) => {
    sheet.getColumn(index + 2).width = 24;
    sheet.getCell(1, index + 2).value = activity.name;
    const date = sheet.getCell(2, index + 2);
    date.value = new Date(`${activity.dueDate}T00:00:00.000Z`);
    date.numFmt = 'dd/mm/yyyy';
  });
  rus.forEach((ru, index) => {
    sheet.getCell(index + 3, 1).value = ru;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
