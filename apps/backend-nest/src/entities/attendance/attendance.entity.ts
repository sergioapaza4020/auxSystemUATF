import { attendanceCombinedChecksV1 as checks } from '../../database/utils/attendance-combined-schema-v1';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import {
  BaseEntity,
  Column,
  Check,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { AttendanceSession } from './attendance-session.entity';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendanceRegistrationMethod } from '@common/enums/attendanceRegistrationMethod';
import { User } from '../users/users.entity';

@Entity('attendances')
@Check('CHK_attendance_combined_evidence', checks.CHK_attendance_combined_evidence)
@Check(
  'CHK_attendance_qr_evidence',
  `"registration_method" <> 'QR' OR (
    "status" = 'PRESENT' AND "marked_at" IS NOT NULL AND isfinite("marked_at")
    AND "id_marked_by" IS NOT NULL AND "id_attendance_session" IS NOT NULL
    AND "id_enrollment" IS NOT NULL AND "accuracy" IS NULL AND "distance_meters" IS NULL
  )`,
)
@Check(
  'CHK_attendance_accuracy',
  `"accuracy" IS NULL OR ("accuracy" >= 0 AND "accuracy" < 'Infinity'::numeric)`,
)
@Check(
  'CHK_attendance_distance',
  `"distance_meters" IS NULL OR ("distance_meters" >= 0 AND "distance_meters" < 'Infinity'::numeric)`,
)
@Check(
  'CHK_attendance_geo_evidence',
  `"registration_method" <> 'GEOLOCATION' OR ("marked_at" IS NOT NULL AND "id_marked_by" IS NOT NULL AND "accuracy" IS NOT NULL AND "distance_meters" IS NOT NULL)`,
)
@Check(
  'CHK_attendance_geo_status',
  `"registration_method" <> 'GEOLOCATION' OR "status" = 'PRESENT'`,
)
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

  @Column({ type: 'varchar', length: 500, nullable: true })
  observation: string | null;

  @Column({
    type: 'enum',
    name: 'registration_method',
    enum: AttendanceRegistrationMethod,
    default: AttendanceRegistrationMethod.MANUAL,
  })
  registrationMethod: AttendanceRegistrationMethod;

  @Column({ name: 'marked_at', type: 'timestamptz', nullable: true })
  markedAt: Date | null;

  // RESTRICT preserves attribution required by GEO evidence; users are normally deactivated.
  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_marked_by', foreignKeyConstraintName: 'FK_attendance_marked_by' })
  markedBy: User | null;

  // PostgreSQL numeric values require explicit Number(...) before future calculations.
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  accuracy: string | null;

  @Column({ name: 'distance_meters', type: 'numeric', precision: 10, scale: 2, nullable: true })
  distanceMeters: string | null;
}
