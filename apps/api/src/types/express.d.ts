import type { UserDocument } from '../modules/users/user.model.js';
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authUser?: UserDocument;
    }
  }
}
export {};
