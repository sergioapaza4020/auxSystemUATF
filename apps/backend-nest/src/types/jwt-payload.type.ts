import { Request } from 'express';

export interface JwtPayload {
  idUser: number;
  username: string;
  email: string;
  permissions: string[];
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
