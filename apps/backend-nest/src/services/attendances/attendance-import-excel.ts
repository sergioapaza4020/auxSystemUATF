import { BadRequestException } from '@nestjs/common';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import {
  loadImportWorkbook,
  parseWorkbookDate,
  readWorkbookRu,
} from '@common/imports/academic-workbook';
import * as Excel from 'exceljs';

const codes = [
  AttendanceStatus.ABSENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.EXCUSED,
] as const;

export function readAttendanceCell(value: Excel.CellValue) {
  if (value == null) return { status: AttendanceStatus.ABSENT, empty: true };
  const index =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[012]$/.test(value)
        ? Number(value)
        : -1;
  return {
    status: Number.isInteger(index) && index >= 0 && index <= 2 ? codes[index] : null,
    empty: false,
  };
}

export async function readAttendanceWorkbook(file?: Express.Multer.File) {
  const book = await loadImportWorkbook(file);
  const sheet = book.worksheets[0];
  if (!sheet || sheet.getCell('A1').value !== 'RU')
    throw new BadRequestException('Escribe RU en A1 y las fechas a partir de B1');
  let width = 1;
  sheet.eachRow((row) =>
    row.eachCell((_, column) => {
      width = Math.max(width, column);
    }),
  );
  if (width < 2) throw new BadRequestException('Ingresa al menos una fecha a partir de B1');
  if (width > 101 || sheet.rowCount > 2001 || width * sheet.rowCount > 25000)
    throw new BadRequestException(
      'Reduce el archivo a 100 fechas, 2000 estudiantes y 25 000 celdas',
    );
  const columns = Array.from({ length: width - 1 }, (_, index) => {
    const cell = sheet.getCell(1, index + 2);
    return { column: cell.address.replace(/\d+$/, ''), date: parseWorkbookDate(cell.value) };
  });
  const rows: { row: number; ru: string; marks: ReturnType<typeof readAttendanceCell>[] }[] = [];
  sheet.eachRow((row, number) => {
    if (number < 2) return;
    rows.push({
      row: number,
      ru: readWorkbookRu(row.getCell(1)),
      marks: columns.map((_, index) => readAttendanceCell(row.getCell(index + 2).value)),
    });
  });
  if (!rows.length) throw new BadRequestException('El archivo no contiene estudiantes');
  return { columns, rows };
}

export async function attendanceWorkbook(rus: string[]) {
  const book = new Excel.Workbook();
  const sheet = book.addWorksheet('Asistencia');
  sheet.getColumn(1).width = 20;
  sheet.getColumn(1).numFmt = '@';
  sheet.getCell('A1').value = 'RU';
  for (let column = 2; column <= 4; column++) {
    sheet.getColumn(column).width = 18;
    sheet.getCell(1, column).numFmt = 'dd/mm/yyyy';
  }
  rus.forEach((ru, index) => {
    sheet.getCell(index + 2, 1).value = ru;
    for (let column = 2; column <= 4; column++) {
      sheet.getCell(index + 2, column).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [0, 2],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Estado de asistencia',
        error: 'Usa 0, 1 o 2',
      };
    }
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}
