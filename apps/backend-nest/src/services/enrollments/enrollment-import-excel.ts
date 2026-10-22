import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  STUDENT_RU_IMPORT_MAX_BYTES,
  parseStudentRuImport,
} from '@common/imports/student-ru-import';

export {
  STUDENT_RU_IMPORT_MAX_BYTES as ENROLLMENT_IMPORT_MAX_BYTES,
  studentRuImportUploadOptions as enrollmentImportUploadOptions,
} from '@common/imports/student-ru-import';
export interface EnrollmentImportInputRow {
  row: number;
  ru: string;
  name?: string;
  lastname?: string;
  ci?: string;
  email?: string;
  errors: string[];
}
const headers = ['Nombres', 'Apellidos', 'CI', 'RU', 'Email'];
export async function parseEnrollmentImport(
  file: Express.Multer.File | undefined,
): Promise<EnrollmentImportInputRow[]> {
  if (!file) throw new BadRequestException('Selecciona un archivo Excel');
  if (file.size > STUDENT_RU_IMPORT_MAX_BYTES || file.buffer.length > STUDENT_RU_IMPORT_MAX_BYTES)
    throw new PayloadTooLargeException('El archivo no debe superar los 5 MB');
  if (
    !/\.xlsx$/i.test(file.originalname) ||
    ![
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
      '',
    ].includes(file.mimetype)
  )
    throw new BadRequestException('Solo se permiten archivos Excel .xlsx');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(file.buffer).buffer);
  } catch {
    throw new BadRequestException('El archivo no es un Excel .xlsx válido o está dañado');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('El archivo no contiene una hoja de estudiantes');
  if (sheet.getCell(1, 1).value === 'RU' && sheet.getRow(1).actualCellCount === 1)
    return parseStudentRuImport(file);
  if (
    sheet.getRow(1).actualCellCount !== headers.length ||
    headers.some((header, i) => sheet.getCell(1, i + 1).value !== header)
  )
    throw new BadRequestException(
      'Encabezados esperados: Nombres, Apellidos, CI, RU, Email; o únicamente RU',
    );
  let last = 1;
  sheet.eachRow((row, number) => {
    if (number > 1 && row.actualCellCount) last = number;
  });
  if (last === 1) throw new BadRequestException('El archivo no contiene estudiantes');
  const rows: EnrollmentImportInputRow[] = [];
  for (let index = 2; index <= last; index++) {
    const row = sheet.getRow(index);
    const errors: string[] = [];
    const values = headers.map((header, i) => {
      const value = row.getCell(i + 1).value;
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (
        (header === 'CI' || header === 'RU') &&
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
      )
        return String(value);
      errors.push(
        `${header}: se requiere texto; identificadores también admiten enteros seguros. No se permiten fórmulas ni fechas`,
      );
      return '';
    });
    if (!values[3]) errors.push('El RU es obligatorio');
    if (!row.actualCellCount) errors.push('La fila está vacía');
    row.eachCell((cell, col) => {
      if (col > headers.length && cell.value !== null)
        errors.push('La fila contiene columnas adicionales');
    });
    rows.push({
      row: index,
      name: values[0],
      lastname: values[1],
      ci: values[2],
      ru: values[3],
      email: values[4].toLowerCase(),
      errors,
    });
  }
  return rows;
}
export async function createEnrollmentImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.columns = headers.map((header) => ({ header, width: 25 }));
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).numFmt = '@';
  });
  sheet.getRow(1).font = { bold: true };
  sheet.getCell('A1').note =
    'Complete todos los campos para cuentas nuevas. Para estudiantes existentes basta RU. No incluya materia, semestre ni rol. Conserve CI y RU como texto.';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
