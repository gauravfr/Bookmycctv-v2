import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { createLogger } from './config/logger.js';
import { MongoDatabase } from './database/mongodb.js';

const start = async (): Promise<void> => {
  const config = parseEnvironment(process.env);
  const logger = createLogger(config.LOG_LEVEL);
  const database = new MongoDatabase(config.MONGODB_URI, config.MONGODB_CONNECT_TIMEOUT_MS, logger);
  await database.connect();
  const server = createServer(createApp({ config, database, logger }));
  server.listen(config.PORT, config.HOST, () =>
    logger.info({ host: config.HOST, port: config.PORT }, 'API listening'),
  );
  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Graceful shutdown started');
    const timer = setTimeout(() => {
      logger.fatal('Graceful shutdown timed out');
      process.exit(1);
    }, 10000).unref();
    server.close((error) => {
      void database.disconnect().finally(() => {
        clearTimeout(timer);
        process.exit(error ? 1 : 0);
      });
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(`API startup failed: ${message}\n`);
  process.exitCode = 1;
});
