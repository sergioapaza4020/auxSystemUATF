import { attendanceCombinedChecksV1 as checks } from '../../database/utils/attendance-combined-schema-v1';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import {
  BaseEntity,
  Column,
  Check,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Attendance } from './attendance.entity';
import { AttendanceSessionMode } from '@common/enums/attendanceSessionMode';

@Entity('attendance_sessions')
@Index('IDX_attendance_session_assistant_date', ['assistantEnrollment', 'date'])
@Check(
  'CHK_attendance_session_combined_configuration',
  checks.CHK_attendance_session_combined_configuration,
)
@Check('CHK_attendance_session_combined_window', checks.CHK_attendance_session_combined_window)
@Check(
  'CHK_attendance_session_qr_fields',
  `"mode" <> 'QR' OR ("id_assistant_enrollment" IS NOT NULL
    AND "latitude" IS NULL AND "longitude" IS NULL
    AND "radius_meters" IS NULL AND "maximum_accepted_accuracy" IS NULL)`,
)
@Check(
  'CHK_attendance_session_qr_window',
  `"mode" <> 'QR' OR (
    isfinite("date")
    AND ("starts_at" IS NULL OR isfinite("starts_at"))
    AND ("ends_at" IS NULL OR isfinite("ends_at"))
    AND ("opened_at" IS NULL OR isfinite("opened_at"))
    AND ("closed_at" IS NULL OR isfinite("closed_at"))
    AND ("cancelled_at" IS NULL OR isfinite("cancelled_at"))
    AND ("opened_at" IS NULL OR (
      "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL
      AND "starts_at" < "ends_at" AND "opened_at" < "ends_at"
      AND "date" = ("starts_at" AT TIME ZONE 'America/La_Paz')::date
      AND ("cancelled_at" IS NULL OR (
        "cancelled_at" >= "opened_at" AND "cancelled_at" < "starts_at"))
    ))
  )`,
)
@Check('CHK_attendance_session_latitude', `"latitude" IS NULL OR "latitude" BETWEEN -90 AND 90`)
@Check(
  'CHK_attendance_session_longitude',
  `"longitude" IS NULL OR "longitude" BETWEEN -180 AND 180`,
)
@Check('CHK_attendance_session_radius', `"radius_meters" IS NULL OR "radius_meters" > 0`)
@Check(
  'CHK_attendance_session_maximum_accuracy',
  `"maximum_accepted_accuracy" IS NULL OR "maximum_accepted_accuracy" > 0`,
)
@Check(
  'CHK_attendance_session_window',
  `"starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"`,
)
@Check('CHK_attendance_session_closed_cancelled', `"closed_at" IS NULL OR "cancelled_at" IS NULL`)
@Check(
  'CHK_attendance_session_closed_opened',
  `"closed_at" IS NULL OR ("opened_at" IS NOT NULL AND "closed_at" >= "opened_at")`,
)
@Check(
  'CHK_attendance_session_closed_start',
  `"closed_at" IS NULL OR "starts_at" IS NULL OR "closed_at" >= "starts_at"`,
)
@Check(
  'CHK_attendance_session_closed_end',
  `"closed_at" IS NULL OR "ends_at" IS NULL OR "closed_at" < "ends_at"`,
)
@Check(
  'CHK_attendance_session_geo_configuration',
  `"mode" <> 'GEOLOCATION' OR "opened_at" IS NULL OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "radius_meters" IS NOT NULL AND "maximum_accepted_accuracy" IS NOT NULL AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL)`,
)
@Check(
  'CHK_attendance_session_manual_fields',
  `"mode" <> 'MANUAL' OR ("latitude" IS NULL AND "longitude" IS NULL AND "radius_meters" IS NULL AND "maximum_accepted_accuracy" IS NULL AND "starts_at" IS NULL AND "ends_at" IS NULL AND "opened_at" IS NULL AND "closed_at" IS NULL AND "cancelled_at" IS NULL)`,
)
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

  @Column({
    type: 'enum',
    enum: AttendanceSessionMode,
    default: AttendanceSessionMode.MANUAL,
  })
  mode: AttendanceSessionMode;

  // PostgreSQL numeric is returned as string; convert explicitly before future calculations.
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  longitude: string | null;

  @Column({ name: 'radius_meters', type: 'integer', nullable: true })
  radiusMeters: number | null;

  @Column({ name: 'maximum_accepted_accuracy', type: 'integer', nullable: true })
  maximumAcceptedAccuracy: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => Attendance, (attendance) => attendance.attendanceSession)
  attendances: Attendance[];
}
