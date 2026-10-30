import 'dotenv/config';
import { parseEnvironment } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { MongoDatabase } from '../database/mongodb.js';
import { passwordSchema, usernameSchema } from '../modules/auth/auth.schemas.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { UserModel } from '../modules/users/user.model.js';

const run = async (): Promise<void> => {
  const config = parseEnvironment(process.env);
  const username = usernameSchema.parse(process.env.BOOTSTRAP_ADMIN_USERNAME);
  const password = passwordSchema.parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim();
  if (!displayName || displayName.length < 2)
    throw new Error('BOOTSTRAP_ADMIN_DISPLAY_NAME is required');
  const logger = createLogger(config.LOG_LEVEL);
  const database = new MongoDatabase(config.MONGODB_URI, config.MONGODB_CONNECT_TIMEOUT_MS, logger);
  try {
    await database.connect();
    if (await UserModel.exists({ role: 'PLATFORM_ADMIN' }))
      throw new Error('A platform administrator already exists; bootstrap refused');
    const passwordHash = await new PasswordService(config).hash(password);
    const user = await UserModel.create({
      organizationId: null,
      username,
      displayName,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || undefined,
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      createdBy: null,
    });
    process.stdout.write(`Platform administrator created: ${user.username}\n`);
  } finally {
    await database.disconnect();
  }
};

run().catch((error: unknown) => {
  process.stderr.write(
    `Bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
  );
  process.exitCode = 1;
});
