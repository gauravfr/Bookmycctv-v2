import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type { AuditService } from '../alerts/audit.service.js';
import { OrganizationModel } from '../organizations/organization.model.js';
import { UserModel, safeUser, type UserDocument } from '../users/user.model.js';
import type { PasswordService } from './password.service.js';
import { RefreshSessionModel } from './refresh-session.model.js';
import type { TokenService } from './token.service.js';

const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');

export class AuthService {
  public constructor(
    private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  private async ensureActive(user: UserDocument): Promise<void> {
    if (user.status !== 'ACTIVE')
      throw new ApiError(403, 'ACCOUNT_UNAVAILABLE', 'Account is not active');
    if (user.organizationId) {
      const organization = await OrganizationModel.findById(user.organizationId)
        .select('status')
        .lean();
      if (!organization || organization.status !== 'ACTIVE')
        throw new ApiError(403, 'ORGANIZATION_UNAVAILABLE', 'Organization is not active');
    }
  }

  private async credentials(user: UserDocument, familyId: string = randomUUID()) {
    const access = await this.tokens.issueAccessToken({
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId?.toString() ?? null,
      mustChangePassword: user.mustChangePassword,
    });
    const secret = this.tokens.createRefreshSecret();
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86400000);
    const session = await RefreshSessionModel.create({
      userId: user._id,
      familyId,
      tokenHash: this.tokens.hashRefreshToken(secret),
      expiresAt,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshToken: `${session.id}.${secret}`,
      refreshTokenExpiresAt: expiresAt.toISOString(),
      user: safeUser(user),
    };
  }

  public async login(username: string, password: string) {
    const user = await UserModel.findOne({ username: username.trim().toLowerCase() }).select(
      '+passwordHash',
    );
    const valid = user
      ? await this.passwords.verify(user.passwordHash, password).catch(() => false)
      : false;
    if (!user || !valid) {
      await this.audit.record({
        actorId: null,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'User',
        organizationId: null,
        metadata: { usernameHash: this.tokens.hashRefreshToken(username.trim().toLowerCase()) },
      });
      throw invalidCredentials();
    }
    await this.ensureActive(user);
    user.lastLoginAt = new Date();
    await user.save();
    await this.audit.record({
      actorId: user._id,
      action: 'AUTH_LOGIN_SUCCEEDED',
      targetType: 'User',
      targetId: user.id,
      organizationId: user.organizationId,
    });
    return this.credentials(user);
  }

  public async refresh(rawToken: string) {
    const [sessionId, secret, extra] = rawToken.split('.');
    if (!sessionId || !secret || extra || !Types.ObjectId.isValid(sessionId))
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
    const session = await RefreshSessionModel.findById(sessionId);
    if (!session) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
    if (session.revokedAt) {
      await RefreshSessionModel.updateMany(
        { familyId: session.familyId, revokedAt: { $exists: false } },
        { revokedAt: new Date() },
      );
      throw new ApiError(401, 'REFRESH_TOKEN_REUSE', 'Refresh token reuse detected');
    }
    if (session.expiresAt <= new Date() || !this.tokens.tokenHashMatches(secret, session.tokenHash))
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
    const user = await UserModel.findById(session.userId);
    if (!user) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
    await this.ensureActive(user);
    const result = await this.credentials(user, session.familyId);
    const replacementId = result.refreshToken.split('.')[0];
    session.revokedAt = new Date();
    session.replacedBy = new Types.ObjectId(replacementId);
    await session.save();
    return result;
  }

  public async logout(rawToken: string): Promise<void> {
    const sessionId = rawToken.split('.')[0];
    if (sessionId && Types.ObjectId.isValid(sessionId))
      await RefreshSessionModel.updateOne(
        { _id: sessionId, revokedAt: { $exists: false } },
        { revokedAt: new Date() },
      );
  }
  public async revokeAll(userId: Types.ObjectId): Promise<void> {
    await RefreshSessionModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }
  public async changePassword(user: UserDocument, current: string, next: string): Promise<void> {
    const withHash = await UserModel.findById(user._id).select('+passwordHash');
    if (!withHash || !(await this.passwords.verify(withHash.passwordHash, current)))
      throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    withHash.passwordHash = await this.passwords.hash(next);
    withHash.mustChangePassword = false;
    withHash.passwordChangedAt = new Date();
    await withHash.save();
    await this.revokeAll(withHash._id);
    await this.audit.record({
      actorId: withHash._id,
      action: 'PASSWORD_CHANGED',
      targetType: 'User',
      targetId: withHash.id,
      organizationId: withHash.organizationId,
    });
  }
}
