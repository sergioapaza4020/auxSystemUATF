import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../roles/roles.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  idPermission: number;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @ManyToMany(() => Role, (role) => role.permissions)
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

  @Column({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt: Date;
}
