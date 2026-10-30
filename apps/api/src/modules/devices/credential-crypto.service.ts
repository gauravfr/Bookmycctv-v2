import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AppConfig } from '../../config/env.js';
import type { EncryptedValue } from './device.model.js';
export class CredentialCryptoService {
  private readonly key: Buffer;
  private readonly keys: Map<string, Buffer>;
  public constructor(
    private readonly config: Pick<
      AppConfig,
      | 'DEVICE_CREDENTIAL_KEY_BASE64'
      | 'DEVICE_CREDENTIAL_KEY_ID'
      | 'DEVICE_CREDENTIAL_PREVIOUS_KEYS_JSON'
    >,
  ) {
    this.key = Buffer.from(config.DEVICE_CREDENTIAL_KEY_BASE64, 'base64');
    if (this.key.length !== 32) throw new Error('Device credential key must be 32 bytes');
    const previous = JSON.parse(config.DEVICE_CREDENTIAL_PREVIOUS_KEYS_JSON) as Record<
      string,
      string
    >;
    this.keys = new Map(
      Object.entries(previous).map(([id, key]) => [id, Buffer.from(key, 'base64')]),
    );
    this.keys.set(config.DEVICE_CREDENTIAL_KEY_ID, this.key);
  }
  public encrypt(value: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyId: this.config.DEVICE_CREDENTIAL_KEY_ID,
    };
  }
  public decrypt(value: EncryptedValue): string {
    const key = this.keys.get(value.keyId);
    if (!key) throw new Error(`Credential key ${value.keyId} is unavailable`);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
