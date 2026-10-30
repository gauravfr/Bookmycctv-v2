import { describe, expect, it } from 'vitest';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { passwordSchema } from '../src/modules/auth/auth.schemas.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { UnavailableCameraResourceValidator } from '../src/modules/cameras/camera-resource.js';
import { testConfig } from './helpers.js';

describe('authentication primitives', () => {
  const passwords = new PasswordService(testConfig);
  it('hashes passwords with Argon2id without retaining plaintext', async () => {
    const hash = await passwords.hash('Strong!Password9');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Strong!Password9');
    expect(await passwords.verify(hash, 'Strong!Password9')).toBe(true);
  });
  it('rejects an incorrect password', async () => {
    const hash = await passwords.hash('Strong!Password9');
    expect(await passwords.verify(hash, 'Wrong!Password9')).toBe(false);
  });
  it('enforces the password policy', () => {
    expect(() => passwordSchema.parse('weak')).toThrow();
    expect(passwordSchema.parse('Strong!Password9')).toBe('Strong!Password9');
  });
  it('issues and verifies constrained access tokens', async () => {
    const tokens = new TokenService(testConfig);
    const issued = await tokens.issueAccessToken({
      userId: '507f1f77bcf86cd799439011',
      role: 'CLIENT',
      organizationId: '507f1f77bcf86cd799439012',
      mustChangePassword: true,
    });
    await expect(tokens.verifyAccessToken(issued.token)).resolves.toMatchObject({
      role: 'CLIENT',
      mustChangePassword: true,
    });
  });
  it('rejects tokens under a different audience', async () => {
    const issuer = new TokenService(testConfig);
    const verifier = new TokenService({ ...testConfig, ACCESS_TOKEN_AUDIENCE: 'other-audience' });
    const issued = await issuer.issueAccessToken({
      userId: '507f1f77bcf86cd799439011',
      role: 'CLIENT',
      organizationId: null,
      mustChangePassword: false,
    });
    await expect(verifier.verifyAccessToken(issued.token)).rejects.toThrow();
  });
  it('creates unpredictable refresh secrets and stable hashes', () => {
    const tokens = new TokenService(testConfig);
    const first = tokens.createRefreshSecret();
    const second = tokens.createRefreshSecret();
    expect(first).not.toBe(second);
    expect(tokens.tokenHashMatches(first, tokens.hashRefreshToken(first))).toBe(true);
  });
  it('fails closed while camera resources are not implemented', async () => {
    await expect(new UnavailableCameraResourceValidator().validate()).rejects.toMatchObject({
      status: 503,
      code: 'CAMERA_INTEGRATION_PENDING',
    });
  });
});
