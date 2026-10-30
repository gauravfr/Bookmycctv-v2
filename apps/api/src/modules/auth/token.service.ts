import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AppConfig } from '../../config/env.js';
import type { UserRole } from '../users/user.model.js';

export interface AccessClaims {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  mustChangePassword: boolean;
  issuedAt: number;
}

export class TokenService {
  private readonly key: Uint8Array;
  public constructor(
    private readonly config: Pick<
      AppConfig,
      | 'ACCESS_TOKEN_SECRET'
      | 'ACCESS_TOKEN_ISSUER'
      | 'ACCESS_TOKEN_AUDIENCE'
      | 'ACCESS_TOKEN_TTL_SECONDS'
    >,
  ) {
    this.key = new TextEncoder().encode(config.ACCESS_TOKEN_SECRET);
  }
  public async issueAccessToken(
    claims: Omit<AccessClaims, 'issuedAt'>,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const token = await new SignJWT({
      role: claims.role,
      organizationId: claims.organizationId,
      mustChangePassword: claims.mustChangePassword,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(this.config.ACCESS_TOKEN_ISSUER)
      .setAudience(this.config.ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
    return { token, expiresInSeconds: this.config.ACCESS_TOKEN_TTL_SECONDS };
  }
  public async verifyAccessToken(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ['HS256'],
      issuer: this.config.ACCESS_TOKEN_ISSUER,
      audience: this.config.ACCESS_TOKEN_AUDIENCE,
    });
    if (
      !payload.sub ||
      typeof payload.role !== 'string' ||
      typeof payload.mustChangePassword !== 'boolean'
    )
      throw new Error('Invalid access token claims');
    return {
      userId: payload.sub,
      role: payload.role as UserRole,
      organizationId: typeof payload.organizationId === 'string' ? payload.organizationId : null,
      mustChangePassword: payload.mustChangePassword,
      issuedAt: payload.iat ?? 0,
    };
  }
  public createRefreshSecret(): string {
    return randomBytes(48).toString('base64url');
  }
  public hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  public tokenHashMatches(token: string, hash: string): boolean {
    const actual = Buffer.from(this.hashRefreshToken(token), 'hex');
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
