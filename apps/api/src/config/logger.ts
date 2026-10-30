import pino from 'pino';

export const createLogger = (level: string) =>
  pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.mongodbUri',
        '*.MONGODB_URI',
        '*.rtspUrl',
        '*.streamUri',
        '*.snapshotUri',
        '*.passwordEncrypted',
        '*.usernameEncrypted',
        '*.ciphertext',
      ],
      censor: '[REDACTED]',
    },
  });

export type AppLogger = ReturnType<typeof createLogger>;
