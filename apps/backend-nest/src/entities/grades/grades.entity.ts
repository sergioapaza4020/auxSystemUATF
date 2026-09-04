import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Enrollment } from '../enrollments/enrollments.entity';
import { GradeSchemeDetail } from '../grade-scheme-detail/grade-scheme-detail.entity';

@Entity('grades')
export class Grade extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade' })
  idGrade: number;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.grades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_enrollment' })
  enrollment: Enrollment;

  @ManyToOne(() => GradeSchemeDetail, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_grade_scheme_detail' })
  gradeSchemeDetail: GradeSchemeDetail;

  @Column({
    name: 'score',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  score: number;
}
