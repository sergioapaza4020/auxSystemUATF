import { BaseEntity } from '@common/entities/base.entity';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Faculty } from '../faculties/faculties.entity';
import { Course } from '../courses/courses.entity';

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

  @OneToMany(() => User, (user) => user.careers, { nullable: true })
  members: User[];

  @ManyToMany(() => Course, (course) => course.career)
  @JoinTable({ name: 'career_courses' })
  courses: Course[];

  @Column({ name: 'name', unique: true })
  name: string;
}
