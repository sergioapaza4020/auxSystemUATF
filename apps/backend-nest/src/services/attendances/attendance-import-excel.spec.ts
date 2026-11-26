import * as Excel from 'exceljs';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import {
  attendanceWorkbook,
  readAttendanceCell,
  readAttendanceWorkbook,
} from './attendance-import-excel';

describe('Matriz Excel de asistencia', () => {
  it.each([0, '0', 1, '1', 2, '2'])('reconoce %s', (value) => {
    const states = [AttendanceStatus.ABSENT, AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED];
    expect(readAttendanceCell(value)).toEqual({ status: states[Number(value)], empty: false });
  });

  it.each([
    3,
    -1,
    1.5,
    'texto',
    '',
    ' ',
    true,
    { formula: '1+0', result: 1 },
    { error: '#REF!' } as const,
  ])('rechaza %j', (value) => {
    expect(readAttendanceCell(value)).toEqual({ status: null, empty: false });
  });

  it('solo trata la celda vacía como una ausencia implícita en el archivo', () => {
    expect(readAttendanceCell(null)).toEqual({ status: AttendanceStatus.ABSENT, empty: true });
  });

  it('genera una plantilla con RU textual, validación y fechas Excel, y acepta texto dd/mm/aaaa', async () => {
    const book = new Excel.Workbook();
    await book.xlsx.load(new Uint8Array(await attendanceWorkbook(['0002'])).buffer);
    const sheet = book.worksheets[0];
    expect(sheet.getCell('A2').value).toBe('0002');
    expect(sheet.getCell('B1').numFmt).toBe('dd/mm/yyyy');
    expect(sheet.getCell('B2').dataValidation).toMatchObject({ type: 'whole', formulae: [0, 2] });
    sheet.getCell('B1').value = new Date('2026-10-05T00:00:00Z');
    sheet.getCell('C1').value = '07/10/2026';
    sheet.getCell('C2').value = 2;
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    const workbook = await readAttendanceWorkbook({
      buffer,
      originalname: 'asistencia.xlsx',
    } as Express.Multer.File);
    expect(workbook.columns).toEqual([
      { column: 'B', date: '2026-10-05' },
      { column: 'C', date: '2026-10-07' },
    ]);
    expect(workbook.rows).toEqual([
      {
        row: 2,
        ru: '0002',
        marks: [
          { status: AttendanceStatus.ABSENT, empty: true },
          { status: AttendanceStatus.EXCUSED, empty: false },
        ],
      },
    ]);
  });
});
