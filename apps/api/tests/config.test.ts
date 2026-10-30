import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../src/config/env.js';
const valid = {
  MONGODB_URI: 'mongodb://localhost:27017/bookmycctv',
  CORS_ORIGINS: 'https://app.example.com',
  ACCESS_TOKEN_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DEVICE_CREDENTIAL_KEY_BASE64: Buffer.alloc(32, 1).toString('base64'),
  DEVICE_CREDENTIAL_KEY_ID: 'test-key',
  DEVICE_CREDENTIAL_PREVIOUS_KEYS_JSON: '{}',
  DEVICE_ALLOWED_CIDRS: '192.168.0.0/16',
};
describe('environment configuration', () => {
  it('parses valid configuration and defaults', () => {
    expect(parseEnvironment(valid as NodeJS.ProcessEnv)).toMatchObject({
      PORT: 3000,
      corsOrigins: ['https://app.example.com'],
      TRUST_PROXY: 0,
    });
  });
  it('rejects missing MongoDB configuration', () => {
    expect(() =>
      parseEnvironment({ CORS_ORIGINS: valid.CORS_ORIGINS } as NodeJS.ProcessEnv),
    ).toThrow('MONGODB_URI');
  });
  it('rejects wildcard CORS', () => {
    expect(() => parseEnvironment({ ...valid, CORS_ORIGINS: '*' } as NodeJS.ProcessEnv)).toThrow(
      'explicit origins',
    );
  });
  it('rejects invalid ports', () => {
    expect(() => parseEnvironment({ ...valid, PORT: '70000' } as NodeJS.ProcessEnv)).toThrow(
      'PORT',
    );
  });
});
