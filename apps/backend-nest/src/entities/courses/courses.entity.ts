import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserCourse } from '../user-courses/user-courses.entity';
import { GradeScheme } from '../grade-schemes/grade-schemes.entity';

@Entity('courses')
export class Course extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_course' })
  idCourse: number;

  @OneToMany(() => UserCourse, (userCourse) => userCourse.course)
  userCourses: UserCourse[];

  @ManyToOne(() => GradeScheme, (scheme) => scheme.courses)
  @JoinColumn({ name: 'id_grade_scheme' })
  gradeScheme: GradeScheme;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'code' })
  code: string;

  @Column({ name: 'group' })
  group: number;

  cantScheduled: number;
}
