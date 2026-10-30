import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../utils/api-error.js';
import { OrganizationModel } from '../modules/organizations/organization.model.js';
import { UserModel, type UserRole } from '../modules/users/user.model.js';
import type { TokenService } from '../modules/auth/token.service.js';

export const authenticate =
  (tokens: TokenService): RequestHandler =>
  async (req, _res, next) => {
    try {
      const header = req.header('authorization');
      if (!header?.startsWith('Bearer '))
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
      const claims = await tokens.verifyAccessToken(header.slice(7)).catch(() => {
        throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
      });
      if (!Types.ObjectId.isValid(claims.userId))
        throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
      const user = await UserModel.findById(claims.userId);
      if (!user || user.status !== 'ACTIVE')
        throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable');
      if (Math.floor(user.passwordChangedAt.getTime() / 1000) > claims.issuedAt)
        throw new ApiError(401, 'ACCESS_TOKEN_REVOKED', 'Access token is no longer valid');
      if (user.organizationId) {
        const organization = await OrganizationModel.findById(user.organizationId)
          .select('status')
          .lean();
        if (!organization || organization.status !== 'ACTIVE')
          throw new ApiError(403, 'ORGANIZATION_UNAVAILABLE', 'Organization is not active');
      }
      req.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.authUser)
      return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
    if (!roles.includes(req.authUser.role))
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    next();
  };

export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (req.authUser?.mustChangePassword)
    return next(
      new ApiError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Password change is required before this action',
      ),
    );
  next();
};
