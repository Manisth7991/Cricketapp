import type { Types } from 'mongoose';
import type { UserRole } from '@playlocal/shared';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      _id: Types.ObjectId;
      role: UserRole;
      name: string;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
