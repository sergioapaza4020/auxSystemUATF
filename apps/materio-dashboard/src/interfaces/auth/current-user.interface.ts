export interface ICurrentUser {
  idUser: number;
  idSession: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}
