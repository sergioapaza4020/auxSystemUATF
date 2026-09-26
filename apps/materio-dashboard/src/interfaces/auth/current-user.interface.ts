export interface ICurrentUser {
  idUser: number;
  idSession: number;
  name: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}
