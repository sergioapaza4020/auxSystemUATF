import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../roles/roles.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  idUser: number;

  @Column({ nullable: true })
  idCourse: number;

  @Column({ default: 0 })
  idCareer: number;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatar: string;

  @Column()
  username: string;

  @Column()
  name: string;

  @Column()
  lastname: string;

  @Column()
  ci: string;

  @Column()
  ru: string;

  @ManyToMany(() => Role)
  @JoinTable({ name: 'user_role' })
  roles: Role[];

  @Column({ default: true })
  isActive: boolean;

  @Column()
  authorId: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @CreateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @CreateDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt: Date;
}
