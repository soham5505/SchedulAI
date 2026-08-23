import { IUser } from '@schedulai/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
