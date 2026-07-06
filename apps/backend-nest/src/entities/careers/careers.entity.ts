import { BaseEntity } from '@common/entities/base.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Faculty } from '../faculties/faculties.entity';

@Entity('careers')
export class Career extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_career' })
  idCareer: number;

  @ManyToOne(() => Faculty, (faculty) => faculty.careers, { nullable: false })
  @JoinColumn({ name: 'id_faculty' })
  faculty: Faculty;

  @OneToOne(() => User, (user) => user.directorCareer)
  @JoinColumn({ name: 'id_director' })
  director: User;

  @OneToMany(() => User, (user) => user.career, { nullable: true })
  members: User[];

  @Column({ name: 'name', unique: true })
  name: string;
}
