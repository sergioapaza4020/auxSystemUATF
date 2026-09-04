import { BaseEntity } from '@common/entities/base.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Course } from '../courses/courses.entity';
import { Semester } from '../semesters/semester.entity';
import { User } from '../users/users.entity';
import { CourseRelations } from '@common/enums/courseRelations';
import { Grade } from '../grades/grades.entity';

@Unique(['user', 'course', 'semester'])
@Entity('enrollments')
export class Enrollment extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_enrollment' })
  idEnrollment: number;

  @ManyToOne(() => Semester, (semester) => semester.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_semester' })
  semester: Semester;

  @ManyToOne(() => Course, (course) => course.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_course' })
  course: Course;

  @ManyToOne(() => User, (user) => user.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_user' })
  user: User;

  @Column({ type: 'enum', enum: CourseRelations, name: 'role' })
  role: CourseRelations;

  @OneToMany(() => Grade, (grade) => grade.enrollment)
  grades: Grade[];
}
