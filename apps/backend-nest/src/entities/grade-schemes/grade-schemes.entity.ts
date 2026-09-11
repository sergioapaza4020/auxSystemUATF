import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from '../courses/courses.entity';
import { GradeSchemeDetail } from '../grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from '../enrollments/enrollments.entity';

@Entity('grade_schemes')
export class GradeScheme extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_scheme' })
  idGradeScheme: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'description', nullable: true })
  description: string;

  @OneToMany(() => Course, (course) => course.gradeScheme)
  courses: Course[];

  @OneToMany(() => GradeSchemeDetail, (detail) => detail.gradeScheme)
  details: GradeSchemeDetail[];

  @OneToOne(() => Enrollment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_assistant_enrollment' })
  assistantEnrollment: Enrollment | null;

  @Column({
    name: 'assistant_percentage',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  assistantPercentage: number | null;
}
