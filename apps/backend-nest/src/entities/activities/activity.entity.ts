import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from '../grades/grades.entity';

@Entity('activities')
export class Activity extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_activity' })
  idActivity: number;

  @ManyToOne(() => GradeSchemeDetail, (detail) => detail.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_grade_scheme_detail' })
  gradeSchemeDetail: GradeSchemeDetail;

  @OneToMany(() => Grade, (grade) => grade.activity)
  grades: Grade[];

  @Column({ name: 'name' })
  name: string;

  @Column({
    name: 'description',
    nullable: true,
  })
  description: string;

  @Column({
    name: 'activity_date',
    type: 'date',
  })
  date: Date;

  @Column({ name: 'order' })
  order: number;
}
