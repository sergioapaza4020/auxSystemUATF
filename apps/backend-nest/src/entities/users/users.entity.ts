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
import { Role } from '../roles/roles.entity';
import { BaseEntity } from '@common/entities/base.entity';
import { UserSession } from '../user-sessions/user-sessions.entity';
import { Faculty } from '../faculties/faculties.entity';
import { Career } from '../careers/careers.entity';
import { UserCourse } from '../user-courses/user-courses.entity';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_user' })
  idUser: number;

  @OneToMany(() => UserCourse, (userCourse) => userCourse.user)
  userCourses: UserCourse[];

  @ManyToOne(() => Career, { nullable: false })
  @JoinColumn({ name: 'id_career' })
  career: Career;

  @Column({ unique: true, name: 'email' })
  email: string;

  @Column({ name: 'password' })
  password: string;

  @Column({ nullable: true, name: 'avatar' })
  avatar: string;

  @Column({ unique: true, name: 'username' })
  username: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'lastname' })
  lastname: string;

  @Column({ unique: true, name: 'ci' })
  ci: string;

  @Column({ unique: true, name: 'ru' })
  ru: string;

  @ManyToMany(() => Role)
  @JoinTable({ name: 'user_role' })
  roles: Role[];

  @OneToMany(() => UserSession, (userSession) => userSession.user)
  sessions: UserSession[];

  @OneToOne(() => Faculty, (faculty) => faculty.dean, { nullable: true })
  deanFaculty?: Faculty;

  @OneToOne(() => Career, (career) => career.director, { nullable: true })
  directorCareer?: Career;
}
