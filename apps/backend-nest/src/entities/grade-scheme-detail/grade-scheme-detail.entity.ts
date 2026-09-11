import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GradeScheme } from '../grade-schemes/grade-schemes.entity';
import { GradeItem } from '../grade-items/grade-items.entity';
import { Activity } from '../activities/activity.entity';

@Entity('grade_scheme_details')
export class GradeSchemeDetail extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_scheme_detail' })
  idGradeSchemeDetail: number;

  @ManyToOne(() => GradeScheme)
  @JoinColumn({ name: 'id_grade_scheme' })
  gradeScheme: GradeScheme;

  @ManyToOne(() => GradeItem)
  @JoinColumn({ name: 'id_grade_item' })
  gradeItem: GradeItem;

  @OneToMany(() => Activity, (activity) => activity.gradeSchemeDetail)
  activities: Activity[];

  @Column({ name: 'percentage' })
  percentage: number;

  @Column({ name: 'order' })
  order: number;
}
