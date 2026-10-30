import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { RefreshSessionModel } from '../src/modules/auth/refresh-session.model.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { testConfig } from './helpers.js';

const audit = { record: vi.fn(async () => undefined) };
const tokens = new TokenService(testConfig);
const passwords = new PasswordService(testConfig);
const service = new AuthService(testConfig, passwords, tokens, audit as never);
const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  id: new Types.ObjectId().toString(),
  organizationId: null,
  username: 'person.one',
  displayName: 'Person One',
  email: null,
  role: 'PLATFORM_ADMIN',
  status: 'ACTIVE',
  mustChangePassword: false,
  passwordChangedAt: new Date(Date.now() - 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: undefined,
  save: vi.fn(async function (this: unknown) {
    return this;
  }),
  ...overrides,
});

describe('authentication service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    audit.record.mockClear();
  });
  it('logs in with valid credentials and returns both token types', async () => {
    const user = fakeUser({ passwordHash: await passwords.hash('Strong!Password9') });
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: async () => user } as never);
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({
      id: new Types.ObjectId().toString(),
    } as never);
    await expect(service.login('PERSON.ONE', 'Strong!Password9')).resolves.toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.stringContaining('.'),
      user: { username: 'person.one' },
    });
  });
  it('uses a generic error for an invalid login', async () => {
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: async () => null } as never);
    await expect(service.login('missing', 'anything')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });
  it('rejects suspended accounts', async () => {
    const user = fakeUser({
      status: 'SUSPENDED',
      passwordHash: await passwords.hash('Strong!Password9'),
    });
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: async () => user } as never);
    await expect(service.login('person.one', 'Strong!Password9')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });
  it('rotates a valid refresh token and revokes its predecessor', async () => {
    const sessionId = new Types.ObjectId();
    const secret = tokens.createRefreshSecret();
    const session = {
      _id: sessionId,
      familyId: 'family',
      tokenHash: tokens.hashRefreshToken(secret),
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: undefined,
      replacedBy: undefined as Types.ObjectId | undefined,
      save: vi.fn(async function (this: unknown) {
        return this;
      }),
    };
    vi.spyOn(RefreshSessionModel, 'findById').mockResolvedValue(session as never);
    vi.spyOn(UserModel, 'findById').mockResolvedValue(fakeUser() as never);
    const replacement = new Types.ObjectId();
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({
      id: replacement.toString(),
    } as never);
    const result = await service.refresh(`${sessionId.toString()}.${secret}`);
    expect(result.refreshToken).toContain(replacement.toString());
    expect(session.revokedAt).toBeInstanceOf(Date);
    expect(session.replacedBy?.toString()).toBe(replacement.toString());
  });
  it('detects refresh-token reuse and revokes the family', async () => {
    const sessionId = new Types.ObjectId();
    const update = vi.spyOn(RefreshSessionModel, 'updateMany').mockResolvedValue({} as never);
    vi.spyOn(RefreshSessionModel, 'findById').mockResolvedValue({
      familyId: 'family',
      revokedAt: new Date(),
    } as never);
    await expect(service.refresh(`${sessionId.toString()}.stolen-secret`)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSE',
    });
    expect(update).toHaveBeenCalledWith(
      { familyId: 'family', revokedAt: { $exists: false } },
      { revokedAt: expect.any(Date) },
    );
  });
  it('revokes a refresh session on logout', async () => {
    const id = new Types.ObjectId();
    const update = vi.spyOn(RefreshSessionModel, 'updateOne').mockResolvedValue({} as never);
    await service.logout(`${id.toString()}.secret`);
    expect(update).toHaveBeenCalled();
  });
});
