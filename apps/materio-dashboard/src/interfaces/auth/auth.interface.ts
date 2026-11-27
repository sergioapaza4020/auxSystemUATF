export interface ILogin {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}
