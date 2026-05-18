import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from '../permissions/permissions.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  idRole: number;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({ name: 'role_permission' })
  permissions: Permission[];

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

  @Column({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt: Date;
}
