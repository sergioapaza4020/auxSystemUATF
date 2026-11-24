import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceSession } from './attendance-session.entity';
import { Enrollment } from '../enrollments/enrollments.entity';
import { attendanceCombinedChecksV1 as checks } from '../../database/utils/attendance-combined-schema-v1';

@Entity('attendance_combined_authorizations')
@Unique('UQ_attendance_combined_authorization_pair', ['attendanceSession', 'studentEnrollment'])
@Unique('UQ_attendance_combined_authorization_hash', ['tokenHash'])
@Index('IDX_attendance_combined_authorization_expiry', ['expiresAt'])
@Check(
  'CHK_attendance_combined_authorization_hash',
  checks.CHK_attendance_combined_authorization_hash,
)
@Check(
  'CHK_attendance_combined_authorization_time',
  checks.CHK_attendance_combined_authorization_time,
)
export class AttendanceCombinedAuthorization {
  @PrimaryGeneratedColumn({
    name: 'id_attendance_combined_authorization',
    primaryKeyConstraintName: 'PK_attendance_combined_authorization',
  })
  idAttendanceCombinedAuthorization: number;

  @ManyToOne(() => AttendanceSession, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'id_attendance_session',
    foreignKeyConstraintName: 'FK_attendance_combined_authorization_session',
  })
  attendanceSession: AttendanceSession;

  @ManyToOne(() => Enrollment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'id_student_enrollment',
    foreignKeyConstraintName: 'FK_attendance_combined_authorization_student',
  })
  studentEnrollment: Enrollment;

  // SHA-256 bytes only. Raw authorization and QR tokens must never be persisted.
  @Column({ name: 'token_hash', type: 'bytea', select: false })
  tokenHash: Buffer;

  @Column({ name: 'qr_validated_at', type: 'timestamptz' })
  qrValidatedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}
