import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttendanceSession } from './attendance-session.entity';
import { Attendance } from './attendance.entity';
import { Enrollment } from '../enrollments/enrollments.entity';
import { User } from '../users/users.entity';
import { AttendanceStatus } from '../../common/enums/attendanceStatus';
import { AttendanceRegistrationMethod } from '../../common/enums/attendanceRegistrationMethod';
import { AttendanceSessionState } from '../../common/enums/attendanceSessionState';
import { AttendanceAuditOperation } from '../../common/enums/attendanceAuditOperation';
import { attendanceCombinedChecksV1 as checks } from '../../database/utils/attendance-combined-schema-v1';

@Entity('attendance_audit_events')
@Index('IDX_attendance_audit_session_time', ['attendanceSession', 'occurredAt'])
@Index('IDX_attendance_audit_mark_time', ['attendance', 'occurredAt'])
@Check('CHK_attendance_audit_operation', checks.CHK_attendance_audit_operation)
@Check('CHK_attendance_audit_state', checks.CHK_attendance_audit_state)
@Check('CHK_attendance_audit_time', checks.CHK_attendance_audit_time)
@Check('CHK_attendance_audit_transition', checks.CHK_attendance_audit_transition)
export class AttendanceAuditEvent {
  @PrimaryGeneratedColumn({
    name: 'id_attendance_audit_event',
    primaryKeyConstraintName: 'PK_attendance_audit_event',
  })
  idAttendanceAuditEvent: number;

  @ManyToOne(() => AttendanceSession, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'id_attendance_session',
    foreignKeyConstraintName: 'FK_attendance_audit_session',
  })
  attendanceSession: AttendanceSession;

  @ManyToOne(() => Enrollment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'id_student_enrollment',
    foreignKeyConstraintName: 'FK_attendance_audit_student',
  })
  studentEnrollment: Enrollment;

  @ManyToOne(() => Attendance, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_attendance', foreignKeyConstraintName: 'FK_attendance_audit_mark' })
  attendance: Attendance;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_actor', foreignKeyConstraintName: 'FK_attendance_audit_actor' })
  actor: User;

  @Column({ type: 'varchar', length: 6 })
  operation: AttendanceAuditOperation;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'attendances_status_enum',
    nullable: true,
  })
  previousStatus: AttendanceStatus | null;

  @Column({
    name: 'new_status',
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'attendances_status_enum',
  })
  newStatus: AttendanceStatus;

  @Column({
    name: 'previous_registration_method',
    type: 'enum',
    enum: AttendanceRegistrationMethod,
    enumName: 'attendances_registration_method_enum',
    nullable: true,
  })
  previousRegistrationMethod: AttendanceRegistrationMethod | null;

  @Column({
    name: 'new_registration_method',
    type: 'enum',
    enum: AttendanceRegistrationMethod,
    enumName: 'attendances_registration_method_enum',
  })
  newRegistrationMethod: AttendanceRegistrationMethod;

  @Column({ name: 'previous_observation', type: 'varchar', length: 500, nullable: true })
  previousObservation: string | null;

  @Column({ name: 'new_observation', type: 'varchar', length: 500, nullable: true })
  newObservation: string | null;

  @Column({ name: 'session_state_at_operation', type: 'varchar', length: 6 })
  sessionStateAtOperation: AttendanceSessionState.OPEN | AttendanceSessionState.CLOSED;
}
