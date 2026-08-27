import { SemesterNumber } from '@common/enums/semesterNumber';
import { Semester } from 'src/entities/semesters/semester.entity';
import { DeepPartial } from 'typeorm';

export const semestersData: DeepPartial<Semester>[] = [
  {
    year: 2026,
    period: SemesterNumber.I,
    startDate: '2026-02-23',
    endDate: '2026-07-10',
  },
  {
    year: 2026,
    period: SemesterNumber.II,
    startDate: '2026-27-07',
    endDate: '2026-12-11',
  },
];
