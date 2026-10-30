import { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AuditLogModel } from '../src/modules/alerts/audit-log.model.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { OrganizationModel } from '../src/modules/organizations/organization.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { testConfig, testLogger } from './helpers.js';

const organizationId = new Types.ObjectId();
const makeUser = (
  role: 'PLATFORM_ADMIN' | 'INSTALLER_ADMIN' | 'CLIENT',
  overrides: Record<string, unknown> = {},
) => ({
  _id: new Types.ObjectId(),
  id: new Types.ObjectId().toString(),
  organizationId: role === 'PLATFORM_ADMIN' ? null : organizationId,
  username: `${role.toLowerCase()}.one`,
  displayName: role,
  role,
  status: 'ACTIVE',
  mustChangePassword: false,
  passwordChangedAt: new Date(Date.now() - 60000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
const authenticatedApp = async (user: ReturnType<typeof makeUser>) => {
  vi.spyOn(UserModel, 'findById').mockResolvedValue(user as never);
  vi.spyOn(OrganizationModel, 'findById').mockReturnValue({
    select: () => ({ lean: async () => ({ status: 'ACTIVE' }) }),
  } as never);
  const token = await new TokenService(testConfig).issueAccessToken({
    userId: user._id.toString(),
    role: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    mustChangePassword: user.mustChangePassword,
  });
  return {
    app: createApp({ config: testConfig, database: { isReady: () => true }, logger: testLogger }),
    authorization: `Bearer ${token.token}`,
  };
};

describe('account-management API authorization', () => {
  afterEach(() => vi.restoreAllMocks());
  it('rejects clients from platform-admin routes', async () => {
    const { app, authorization } = await authenticatedApp(makeUser('CLIENT'));
    const response = await request(app)
      .get('/api/v1/platform/organizations')
      .set('authorization', authorization);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
  it('scopes client lookup to the authenticated installer organization', async () => {
    const { app, authorization } = await authenticatedApp(makeUser('INSTALLER_ADMIN'));
    const lookup = vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
    const foreignId = new Types.ObjectId();
    const response = await request(app)
      .get(`/api/v1/admin/clients/${foreignId.toString()}`)
      .set('authorization', authorization);
    expect(response.status).toBe(404);
    expect(lookup.mock.calls[0]?.[0]).toMatchObject({
      _id: foreignId,
      organizationId,
      role: 'CLIENT',
    });
  });
  it('creates a client without returning its password hash', async () => {
    const admin = makeUser('INSTALLER_ADMIN');
    const { app, authorization } = await authenticatedApp(admin);
    const client = makeUser('CLIENT', {
      username: 'new.client',
      displayName: 'New Client',
      passwordHash: 'hidden',
      createdBy: admin._id,
    });
    vi.spyOn(UserModel, 'create').mockResolvedValue(client as never);
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
    const response = await request(app)
      .post('/api/v1/admin/clients')
      .set('authorization', authorization)
      .send({
        username: 'new.client',
        displayName: 'New Client',
        temporaryPassword: 'Strong!Password9',
      });
    expect(response.status).toBe(201);
    expect(response.body.data.user.username).toBe('new.client');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });
  it('rejects malformed MongoDB identifiers', async () => {
    const { app, authorization } = await authenticatedApp(makeUser('INSTALLER_ADMIN'));
    const response = await request(app)
      .get('/api/v1/admin/clients/not-an-object-id')
      .set('authorization', authorization);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
  });
});
