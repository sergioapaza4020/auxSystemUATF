// Minimal real TypeORM mappings for the disposable integration database only.
// They exercise production services and SQL without requiring unrelated app tables.
import { EntitySchema } from 'typeorm';
import { AttendanceSession } from '../src/entities/attendance/attendance-session.entity';
import { Attendance } from '../src/entities/attendance/attendance.entity';
import { Enrollment } from '../src/entities/enrollments/enrollments.entity';
import { User } from '../src/entities/users/users.entity';
import { Course } from '../src/entities/courses/courses.entity';
import { Semester } from '../src/entities/semesters/semester.entity';
import { GradeScheme } from '../src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from '../src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeItem } from '../src/entities/grade-items/grade-items.entity';
import { AttendanceSessionMode } from '../src/common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod } from '../src/common/enums/attendanceRegistrationMethod';
import { AttendanceStatus } from '../src/common/enums/attendanceStatus';

export const attendancePostgresEntities = [
  new EntitySchema<User>({
    name: 'User',
    target: User,
    tableName: 'users',
    columns: {
      idUser: { name: 'id_user', type: Number, primary: true },
      name: { type: String },
      lastname: { type: String },
    },
  }),
  new EntitySchema<Course>({
    name: 'Course',
    target: Course,
    tableName: 'courses',
    columns: { idCourse: { name: 'id_course', type: Number, primary: true } },
  }),
  new EntitySchema<Semester>({
    name: 'Semester',
    target: Semester,
    tableName: 'semesters',
    columns: {
      idSemester: { name: 'id_semester', type: Number, primary: true },
      startDate: { name: 'start_date', type: 'timestamp' },
      endDate: { name: 'end_date', type: 'timestamp' },
    },
  }),
  new EntitySchema<Enrollment>({
    name: 'Enrollment',
    target: Enrollment,
    tableName: 'enrollments',
    columns: {
      idEnrollment: { name: 'id_enrollment', type: Number, primary: true },
      isActive: { name: 'is_active', type: Boolean },
      role: { type: String },
    },
    relations: {
      user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'id_user' } },
      course: { type: 'many-to-one', target: 'Course', joinColumn: { name: 'id_course' } },
      semester: { type: 'many-to-one', target: 'Semester', joinColumn: { name: 'id_semester' } },
    },
  }),
  new EntitySchema<AttendanceSession>({
    name: 'AttendanceSession',
    target: AttendanceSession,
    tableName: 'attendance_sessions',
    columns: {
      idAttendanceSession: {
        name: 'id_attendance_session',
        type: Number,
        primary: true,
        generated: true,
      },
      date: { type: 'date' },
      mode: {
        type: 'enum',
        enum: AttendanceSessionMode,
        enumName: 'attendance_sessions_mode_enum',
        default: AttendanceSessionMode.MANUAL,
      },
      latitude: { type: 'numeric', precision: 9, scale: 6, nullable: true },
      longitude: { type: 'numeric', precision: 10, scale: 6, nullable: true },
      radiusMeters: { name: 'radius_meters', type: Number, nullable: true },
      maximumAcceptedAccuracy: { name: 'maximum_accepted_accuracy', type: Number, nullable: true },
      startsAt: { name: 'starts_at', type: 'timestamptz', nullable: true },
      endsAt: { name: 'ends_at', type: 'timestamptz', nullable: true },
      openedAt: { name: 'opened_at', type: 'timestamptz', nullable: true },
      closedAt: { name: 'closed_at', type: 'timestamptz', nullable: true },
      cancelledAt: { name: 'cancelled_at', type: 'timestamptz', nullable: true },
    },
    relations: {
      assistantEnrollment: {
        type: 'many-to-one',
        target: 'Enrollment',
        joinColumn: { name: 'id_assistant_enrollment' },
      },
      attendances: { type: 'one-to-many', target: 'Attendance', inverseSide: 'attendanceSession' },
    },
  }),
  new EntitySchema<Attendance>({
    name: 'Attendance',
    target: Attendance,
    tableName: 'attendances',
    columns: {
      idAttendance: { name: 'id_attendance', type: Number, primary: true, generated: true },
      status: { type: 'enum', enum: AttendanceStatus, enumName: 'attendances_status_enum' },
      observation: { type: String, nullable: true },
      registrationMethod: {
        name: 'registration_method',
        type: 'enum',
        enum: AttendanceRegistrationMethod,
        enumName: 'attendances_registration_method_enum',
        default: AttendanceRegistrationMethod.MANUAL,
      },
      markedAt: { name: 'marked_at', type: 'timestamptz', nullable: true },
      accuracy: { type: 'numeric', precision: 10, scale: 2, nullable: true },
      distanceMeters: {
        name: 'distance_meters',
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
      },
    },
    relations: {
      attendanceSession: {
        type: 'many-to-one',
        target: 'AttendanceSession',
        joinColumn: { name: 'id_attendance_session' },
      },
      enrollment: {
        type: 'many-to-one',
        target: 'Enrollment',
        joinColumn: { name: 'id_enrollment' },
      },
      markedBy: {
        type: 'many-to-one',
        target: 'User',
        nullable: true,
        joinColumn: { name: 'id_marked_by' },
      },
    },
    uniques: [{ columns: ['attendanceSession', 'enrollment'] }],
  }),
  new EntitySchema<GradeScheme>({
    name: 'GradeScheme',
    target: GradeScheme,
    tableName: 'grade_schemes',
    columns: {
      idGradeScheme: { name: 'id_grade_scheme', type: Number, primary: true },
      isActive: { name: 'is_active', type: Boolean },
    },
    relations: {
      assistantEnrollment: {
        type: 'many-to-one',
        target: 'Enrollment',
        joinColumn: { name: 'id_assistant_enrollment' },
      },
      details: { type: 'one-to-many', target: 'GradeSchemeDetail', inverseSide: 'gradeScheme' },
    },
  }),
  new EntitySchema<GradeSchemeDetail>({
    name: 'GradeSchemeDetail',
    target: GradeSchemeDetail,
    tableName: 'grade_scheme_details',
    columns: {
      idGradeSchemeDetail: { name: 'id_grade_scheme_detail', type: Number, primary: true },
      permissionWeight: { name: 'permission_weight', type: Number },
    },
    relations: {
      gradeScheme: {
        type: 'many-to-one',
        target: 'GradeScheme',
        joinColumn: { name: 'id_grade_scheme' },
      },
      gradeItem: {
        type: 'many-to-one',
        target: 'GradeItem',
        joinColumn: { name: 'id_grade_item' },
      },
    },
  }),
  new EntitySchema<GradeItem>({
    name: 'GradeItem',
    target: GradeItem,
    tableName: 'grade_items',
    columns: {
      idGradeItem: { name: 'id_grade_item', type: Number, primary: true },
      name: { type: String },
    },
  }),
];
