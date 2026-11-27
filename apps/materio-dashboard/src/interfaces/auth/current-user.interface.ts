export interface ICurrentUser {
  idUser: number;
  idSession: number;
  name: string;
  lastname?: string;
  avatarVersion?: string | null;
  username: string;
  ci?: string | null;
  ru?: string | null;
  email: string;
  roles: string[];
  permissions: string[];
}
