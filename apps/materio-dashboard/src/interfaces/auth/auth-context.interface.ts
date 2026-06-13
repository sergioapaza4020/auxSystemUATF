import type { ICurrentUser } from './current-user.interface';

export interface AuthContextType {
  user: ICurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}
