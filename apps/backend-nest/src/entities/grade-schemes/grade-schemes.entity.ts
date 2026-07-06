import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from '../courses/courses.entity';
import { GradeSchemeDetail } from '../grade-scheme-detail/grade-scheme-detail.entity';

@Entity('grade_schemes')
export class GradeScheme extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_scheme' })
  idGradeScheme: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'description' })
  description: string;

  @OneToMany(() => Course, (course) => course.gradeScheme)
  courses: Course[];

  @OneToMany(() => GradeSchemeDetail, (detail) => detail.gradeScheme)
  details: GradeSchemeDetail[];
}
