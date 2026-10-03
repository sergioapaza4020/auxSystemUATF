import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import * as ExcelJS from 'exceljs';

export const STUDENT_RU_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const studentRuImportUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: STUDENT_RU_IMPORT_MAX_BYTES, files: 1 },
};

export interface StudentRuImportInputRow {
  row: number;
  ru: string;
  errors: string[];
}

export async function parseStudentRuImport(
  file: Express.Multer.File | undefined,
): Promise<StudentRuImportInputRow[]> {
  if (!file) throw new BadRequestException('Selecciona un archivo Excel');
  if (file.size > STUDENT_RU_IMPORT_MAX_BYTES || file.buffer.length > STUDENT_RU_IMPORT_MAX_BYTES)
    throw new PayloadTooLargeException('El archivo no debe superar los 5 MB');
  if (!/\.xlsx$/i.test(file.originalname))
    throw new BadRequestException('Solo se permiten archivos .xlsx');
  // Some browsers send octet-stream; the workbook parser verifies the actual format.
  if (
    ![
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
      '',
    ].includes(file.mimetype)
  )
    throw new BadRequestException('El tipo de archivo no corresponde a un Excel .xlsx');
  const workbook = new ExcelJS.Workbook();
  try {
    const data = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    );
    await workbook.xlsx.load(data as ArrayBuffer);
  } catch {
    throw new BadRequestException('El archivo no es un Excel .xlsx válido o está dañado');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('El archivo no contiene una hoja de estudiantes');
  if (sheet.getCell(1, 1).value !== 'RU' || sheet.getRow(1).actualCellCount !== 1)
    throw new BadRequestException('La primera fila debe contener únicamente el encabezado RU');

  let lastDataRow = 1;
  sheet.eachRow((row, number) => {
    if (number > 1 && row.actualCellCount > 0) lastDataRow = number;
  });
  if (lastDataRow === 1) throw new BadRequestException('El archivo no contiene estudiantes');
  const rows: StudentRuImportInputRow[] = [];
  for (let index = 2; index <= lastDataRow; index++) {
    const excelRow = sheet.getRow(index);
    const value = excelRow.getCell(1).value;
    const errors: string[] = [];
    let ru = '';
    if (typeof value === 'string') ru = value.trim();
    else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      ru = String(value);
    else if (value !== null && value !== undefined)
      errors.push('El RU debe ser texto o un entero seguro; no se permiten fórmulas ni fechas');
    if (!ru) errors.push('El RU es obligatorio');
    if (excelRow.actualCellCount === 0) errors.push('La fila está vacía');
    excelRow.eachCell((cell, column) => {
      if (column > 1 && cell.value !== null) errors.push('La fila debe contener únicamente el RU');
    });
    rows.push({ row: index, ru, errors });
  }
  return rows;
}

export async function createStudentRuImportTemplate(note?: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.columns = [{ header: 'RU', key: 'ru', width: 25 }];
  sheet.getColumn(1).numFmt = '@';
  sheet.getRow(1).font = { bold: true };
  sheet.getCell('A1').note =
    note ??
    'Un RU por fila. Ejemplos ficticios: 123456 y 654321. Conserve los ceros iniciales como texto. No incluya materia ni semestre.';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
