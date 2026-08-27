import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/users.entity';
import { Course } from '../courses/courses.entity';
import { CourseRelations } from '@common/enums/courseRelations';

@Entity('user_courses')
export class UserCourse extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_user_courses' })
  idUserCourses: number;

  @ManyToOne(() => User, (user) => user.userCourses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_user' })
  user: User;

  @ManyToOne(() => Course, (course) => course.userCourses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_course' })
  course: Course;

  @Column({ type: 'enum', enum: CourseRelations })
  relationType: CourseRelations;
}
