import type { IUser } from '../users/user.interface';

export interface ISession {
  idSession: number;
  user: IUser;
  browser: string;
  os: string;
  device: string;
  ipAddress: string;
  lastUsedAt: Date | null;
  isActive: boolean;
}
