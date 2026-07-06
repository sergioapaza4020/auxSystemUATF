import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GradeSchemeDetail } from '../grade-scheme-detail/grade-scheme-detail.entity';

@Entity('grade_items')
export class GradeItem extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_grade_item' })
  idGradeItem: number;

  @OneToMany(() => GradeSchemeDetail, (detail) => detail.gradeItem)
  gradeSchemes: GradeSchemeDetail[];

  @Column({ name: 'name', unique: true })
  name: string;
}
