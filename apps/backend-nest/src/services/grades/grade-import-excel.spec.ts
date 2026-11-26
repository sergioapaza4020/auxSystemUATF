import * as Excel from 'exceljs';
import {
  deadline,
  gradeWorkbook,
  normalizeActivityName,
  readGradeWorkbook,
  similarActivity,
} from './grade-import-excel';

const upload = (buffer: Buffer) =>
  ({ buffer, originalname: 'notas.xlsx', size: buffer.length }) as Express.Multer.File;

describe('Excel de calificaciones', () => {
  it('genera fechas nativas y conserva RU de texto, cero y vacío en varias columnas', async () => {
    const file = await gradeWorkbook(
      ['00123', '00042'],
      [
        { name: 'Práctica 1', dueDate: '2026-10-15' },
        { name: 'Laboratorio', dueDate: '2026-10-22' },
      ],
    );
    const book = new Excel.Workbook();
    await book.xlsx.load(new Uint8Array(file).buffer);
    const sheet = book.worksheets[0];
    expect(sheet.getCell('B2').value).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    expect(sheet.getCell('B2').numFmt).toBe('dd/mm/yyyy');
    sheet.getCell('C2').value = '22/10/2026';
    sheet.getCell('B3').value = 0;
    sheet.getCell('C4').value = 73.25;
    const parsed = await readGradeWorkbook(upload(Buffer.from(await book.xlsx.writeBuffer())));
    expect(parsed.columns.map(({ dueDate }) => dueDate)).toEqual(['2026-10-15', '2026-10-22']);
    expect(parsed.rows).toEqual([
      { row: 3, ru: '00123', scores: [0, null] },
      { row: 4, ru: '00042', scores: [null, 73.25] },
    ]);
  });

  it.each(['31/02/2026', '2026-10-15', '1/10/2026', 46310, null])(
    'rechaza la fecha %s',
    (value) => {
      expect(deadline(value)).toBeNull();
    },
  );

  it('rechaza archivos sin notas', async () => {
    const file = await gradeWorkbook(['00123'], [{ name: 'Actividad', dueDate: '2026-10-15' }]);
    await expect(readGradeWorkbook(upload(file))).rejects.toThrow('no contiene calificaciones');
  });

  it('distingue coincidencias exactas de sugerencias sin mezclar números de actividades', () => {
    expect(normalizeActivityName(' PRÁCTICA   1 ')).toBe('practica 1');
    expect(similarActivity('Práctica 1', 'Práctica N.º 1')).toBe(true);
    expect(similarActivity('Práctica 1', 'Practica 01')).toBe(true);
    expect(similarActivity('Práctica 1', 'Practica 2')).toBe(false);
  });
});
