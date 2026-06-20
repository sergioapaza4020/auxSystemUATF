import { BaseEntity } from '@common/entities/base.entity';
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/users.entity';
import { Career } from '../careers/careers.entity';

@Entity('faculties')
export class Faculty extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_faculty' })
  idFaculty: number;

  @Column({ name: 'name' })
  name: string;

  @OneToOne(() => User, (user) => user.deanFaculty)
  @JoinColumn({ name: 'id_user_director' })
  dean: User;

  @OneToMany(() => Career, (career) => career.faculty)
  careers: Career[];
}
