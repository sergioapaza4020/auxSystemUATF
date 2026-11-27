import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/users.entity';

export type PasswordRecoveryState =
  | 'pending'
  | 'sent'
  | 'verified'
  | 'consumed'
  | 'invalidated'
  | 'blocked';

@Entity('password_recovery_requests')
@Check(
  'password_recovery_requests_state_check',
  "state IN ('pending','sent','verified','consumed','invalidated','blocked')",
)
@Check('password_recovery_requests_attempts_check', 'attempts BETWEEN 0 AND 5')
@Index('password_recovery_one_open', { synchronize: false })
@Index('password_recovery_expiry', ['expiresAt'])
@Index('password_recovery_user_window', ['idUser', 'createdAt'])
export class PasswordRecoveryRequest {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_user', type: 'integer' })
  idUser: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'id_user',
    foreignKeyConstraintName: 'password_recovery_requests_id_user_fkey',
  })
  user: User;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'code_digest', type: 'char', length: 64, select: false })
  codeDigest: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'clock_timestamp()' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 12 })
  state: PasswordRecoveryState;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'proof_digest', type: 'char', length: 64, nullable: true, select: false })
  proofDigest: string | null;
}
