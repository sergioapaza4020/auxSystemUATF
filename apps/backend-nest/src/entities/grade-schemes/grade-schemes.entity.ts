import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GradeSchemeItem } from '../grade-scheme-items/grade-scheme-items.entity';
import { Course } from '../courses/courses.entity';

@Entity('grade_schemes')
export class GradeScheme extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_scheme' })
  idGradeScheme: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'name' })
  description: string;

  @OneToMany(() => Course, (course) => course.gradeScheme)
  courses: Course[];

  @OneToMany(() => GradeSchemeItem, (item) => item.gradeScheme)
  items: GradeSchemeItem[];
}
