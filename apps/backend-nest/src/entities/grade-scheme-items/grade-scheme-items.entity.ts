import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GradeScheme } from '../grade-schemes/grade-schemes.entity';

@Entity('grade_scheme_items')
export class GradeSchemeItem extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_scheme_item' })
  idGradeSchemeItem: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'percentage' })
  percentage: number;

  @ManyToOne(() => GradeScheme, (scheme) => scheme.items)
  @JoinColumn({ name: 'grade_scheme' })
  gradeScheme: GradeScheme;
}
