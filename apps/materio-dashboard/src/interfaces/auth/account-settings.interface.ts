export interface OwnSession {
  idSession: number;
  browser: string | null;
  os: string | null;
  device: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileFields {
  name: string;
  lastname: string;
  email: string;
}

export interface PendingEmailChange {
  newEmail: string;
  expiresAt: string;
}
