import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Attendance } from './attendance.entity';

@Entity('attendance_sessions')
@Unique(['assistantEnrollment', 'date'])
export class AttendanceSession extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_attendance_session' })
  idAttendanceSession: number;

  @ManyToOne(() => Enrollment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_assistant_enrollment' })
  assistantEnrollment: Enrollment;

  @Column({ name: 'date', type: 'date' })
  date: Date;

  @OneToMany(() => Attendance, (attendance) => attendance.attendanceSession)
  attendances: Attendance[];
}
