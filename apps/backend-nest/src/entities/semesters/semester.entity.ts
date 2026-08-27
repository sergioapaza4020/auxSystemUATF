import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Enrollment } from '../enrollments/enrollments.entity';
import { SemesterNumber } from '@common/enums/semesterNumber';

@Entity('semesters')
export class Semester extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_semester' })
  idSemester: number;

  @Column({ name: 'year' })
  year: number;

  @Column({ name: 'semester_number' })
  period: SemesterNumber;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date' })
  endDate: Date;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.semester)
  enrollments: Enrollment[];
}
