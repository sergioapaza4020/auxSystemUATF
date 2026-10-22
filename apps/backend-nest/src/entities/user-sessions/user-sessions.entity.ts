import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { Transform } from 'class-transformer';
import { normalizeIp } from '@common/utils/normalize-ip';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn({ name: 'id_session' })
  idSession: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_user' })
  user: User;

  @Column({ name: 'refresh_token' })
  refreshToken: string;

  @Column({
    name: 'ip_address',
    type: 'varchar',
    nullable: true,
  })
  // Normalize historical values only in responses, without rewriting stored sessions.
  @Transform(({ value }: { value: string | null | undefined }) => normalizeIp(value), {
    toPlainOnly: true,
  })
  ipAddress: string | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    nullable: true,
  })
  userAgent: string | null;

  @Column({
    name: 'browser',
    type: 'varchar',
    nullable: true,
  })
  browser: string | null;

  @Column({
    name: 'os',
    type: 'varchar',
    nullable: true,
  })
  os: string | null;

  @Column({
    name: 'device',
    type: 'varchar',
    nullable: true,
  })
  device: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
  })
  expiresAt: Date;

  @Column({
    name: 'last_used_at',
    type: 'timestamp',
    nullable: true,
  })
  lastUsedAt: Date;

  @Column({
    name: 'revoked_at',
    type: 'timestamp',
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'enum',
    enum: SessionRevokeReasons,
    nullable: true,
  })
  revokedReason: SessionRevokeReasons | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revokedBy: User | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
