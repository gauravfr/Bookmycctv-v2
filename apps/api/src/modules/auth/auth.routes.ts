import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, objectId } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { safeUser } from '../users/user.model.js';
import { changePasswordSchema, loginSchema, logoutSchema, refreshSchema } from './auth.schemas.js';
import { PushTokenModel } from '../notifications/notification.model.js';
import type { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';

export const createAuthRouter = (auth: AuthService, tokens: TokenService): Router => {
  const router = Router();
  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = loginSchema.parse(req.body);
      return sendSuccess(res, 200, await auth.login(body.username, body.password));
    }),
  );
  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const body = refreshSchema.parse(req.body);
      return sendSuccess(res, 200, await auth.refresh(body.refreshToken));
    }),
  );
  router.use(authenticate(tokens));
  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const body = logoutSchema.parse(req.body);
      await auth.logout(body.refreshToken);
      if (body.pushTokenId)
        await PushTokenModel.updateOne(
          { _id: objectId(body.pushTokenId, 'pushTokenId'), userId: req.authUser!._id },
          { active: false },
        );
      return sendSuccess(res, 200, { message: 'Logged out' });
    }),
  );
  router.post(
    '/logout-all',
    asyncHandler(async (req, res) => {
      await auth.revokeAll(req.authUser!._id);
      return sendSuccess(res, 200, { message: 'All sessions revoked' });
    }),
  );
  router.get('/me', (req, res) =>
    sendSuccess(res, 200, {
      user: safeUser(req.authUser!),
      permissions:
        req.authUser!.role === 'CLIENT' ? ['assigned-camera-actions'] : [req.authUser!.role],
    }),
  );
  router.post(
    '/change-password',
    asyncHandler(async (req, res) => {
      const body = changePasswordSchema.parse(req.body);
      await auth.changePassword(req.authUser!, body.currentPassword, body.newPassword);
      return sendSuccess(res, 200, { message: 'Password changed; sign in again' });
    }),
  );
  return router;
};
