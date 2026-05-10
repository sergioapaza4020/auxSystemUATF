import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
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
}
