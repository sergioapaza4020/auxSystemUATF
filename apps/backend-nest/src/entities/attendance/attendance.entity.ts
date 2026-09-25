import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { AttendanceSession } from './attendance-session.entity';
import { AttendanceStatus } from '@common/enums/attendanceStatus';

@Entity('attendances')
@Unique(['attendanceSession', 'enrollment'])
export class Attendance extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_attendance' })
  idAttendance: number;

  @ManyToOne(() => AttendanceSession, (attendanceSession) => attendanceSession.attendances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_attendance_session' })
  attendanceSession: AttendanceSession;

  @ManyToOne(() => Enrollment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_enrollment' })
  enrollment: Enrollment;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttendanceStatus,
  })
  status: AttendanceStatus;
}
