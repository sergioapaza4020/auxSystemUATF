import type { IBase } from '../base.interface';

export interface ISemester extends IBase {
  year: number;
  period: string;
  startDate: Date;
  endDate: Date;
}
