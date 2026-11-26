import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/users.entity';

@Entity('email_change_requests')
@Index('email_change_user_created', ['idUser', 'createdAt'])
@Index('email_change_destination_created', ['newEmail', 'createdAt'])
@Index('email_change_created', ['createdAt'])
@Index('email_change_one_pending', { synchronize: false })
export class EmailChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_user', type: 'integer' })
  idUser: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'id_user' })
  user: User;

  @Column({ name: 'id_session', type: 'integer' })
  idSession: number;

  @Column({ name: 'new_email', length: 254 })
  newEmail: string;

  @Column({ name: 'old_email', type: 'varchar' })
  oldEmail: string;

  @Column({ name: 'token_hash', length: 64, unique: true, select: false })
  tokenHash: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt: Date | null;
}
