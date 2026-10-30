import argon2 from 'argon2';
import type { AppConfig } from '../../config/env.js';

export class PasswordService {
  public constructor(
    private readonly config: Pick<
      AppConfig,
      'ARGON2_MEMORY_COST' | 'ARGON2_TIME_COST' | 'ARGON2_PARALLELISM'
    >,
  ) {}
  public hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.ARGON2_MEMORY_COST,
      timeCost: this.config.ARGON2_TIME_COST,
      parallelism: this.config.ARGON2_PARALLELISM,
    });
  }
  public verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
