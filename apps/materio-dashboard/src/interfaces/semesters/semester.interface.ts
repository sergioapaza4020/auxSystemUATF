export interface ISemester {
  idSemester: number;
  isActive: boolean;
  year: number;
  period: 'I' | 'II';
  startDate: string;
  endDate: string;
}

export type ISemesterWrite = Pick<ISemester, 'year' | 'period' | 'startDate' | 'endDate'>;
