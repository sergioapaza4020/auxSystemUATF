export interface AuthResponse {
  idUser: number;
  username: string;
  email: string;
  access_token: string;
  expiredAt: number;
}
