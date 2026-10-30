import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string()
    .min(1)
    .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), {
      message: 'must use mongodb:// or mongodb+srv://',
    }),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
  CORS_ORIGINS: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JSON_BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb)$/i)
    .default('100kb'),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_ISSUER: z.string().min(1).default('bookmycctv-api'),
  ACCESS_TOKEN_AUDIENCE: z.string().min(1).default('bookmycctv-mobile'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  DEVICE_CREDENTIAL_KEY_BASE64: z.string().refine((value) => {
    try {
      return Buffer.from(value, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'must decode to exactly 32 bytes'),
  DEVICE_CREDENTIAL_KEY_ID: z.string().min(1),
  DEVICE_CREDENTIAL_PREVIOUS_KEYS_JSON: z
    .string()
    .default('{}')
    .refine((value) => {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        return Object.values(parsed).every(
          (key) => typeof key === 'string' && Buffer.from(key, 'base64').length === 32,
        );
      } catch {
        return false;
      }
    }, 'must be a JSON object of key IDs to 32-byte base64 keys'),
  DEVICE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(60000).default(8000),
  DEVICE_CONNECT_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  DEVICE_ALLOWED_CIDRS: z.string().min(1),
  DEVICE_OPERATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  DEVICE_OPERATION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  FFPROBE_PATH: z.string().optional(),
  MEDIA_GATEWAY_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  MEDIA_GATEWAY_API_URL: z.string().url().default('http://127.0.0.1:9997'),
  MEDIA_GATEWAY_PUBLIC_HLS_URL: z.string().url().default('http://127.0.0.1:8888'),
  MEDIA_GATEWAY_PUBLIC_WEBRTC_URL: z.string().url().default('http://127.0.0.1:8889'),
  MEDIA_GATEWAY_API_USER: z.string().default('api'),
  MEDIA_GATEWAY_API_PASSWORD: z.string().default('change-me'),
  MEDIA_AUTH_SHARED_SECRET: z.string().min(32).default('change-this-media-auth-secret-32chars'),
  STREAM_SESSION_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  STREAM_START_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(12000),
  STREAM_IDLE_SHUTDOWN_MS: z.coerce.number().int().min(1000).default(30000),
  STREAM_MAX_GLOBAL: z.coerce.number().int().min(1).default(100),
  STREAM_MAX_PER_ORGANIZATION: z.coerce.number().int().min(1).default(20),
  STREAM_MAX_PER_USER: z.coerce.number().int().min(1).default(4),
  GATEWAY_ENROLLMENT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  GATEWAY_OFFLINE_AFTER_SECONDS: z.coerce.number().int().min(10).default(90),
  SNAPSHOT_MAX_BYTES: z.coerce.number().int().min(1024).default(5242880),
  AI_WORKER_SHARED_SECRET: z.string().min(32).default('change-this-ai-worker-secret-32chars'),
  EVIDENCE_DIR: z.string().min(1).default('/evidence'),
  EVENT_MAX_AGE_SECONDS: z.coerce.number().int().min(30).default(300),
  EVENT_FUTURE_SKEW_SECONDS: z.coerce.number().int().min(1).default(30),
  EVENT_RETENTION_DAYS: z.coerce.number().int().min(1).default(180),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
  JOB_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  JOB_WORKER_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  JOB_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  EXPO_PUSH_API_URL: z.string().url().default('https://exp.host/--/api/v2/push/send'),
  EXPO_RECEIPTS_API_URL: z.string().url().default('https://exp.host/--/api/v2/push/getReceipts'),
  PUSH_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  OFFLINE_FAILURE_THRESHOLD: z.coerce.number().int().min(2).default(3),
});

export type Environment = z.infer<typeof environmentSchema>;
export type AppConfig = Omit<Environment, 'CORS_ORIGINS' | 'DEVICE_ALLOWED_CIDRS'> & {
  corsOrigins: string[];
  deviceAllowedCidrs: string[];
};

export const parseEnvironment = (input: NodeJS.ProcessEnv): AppConfig => {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  const corsOrigins = result.data.CORS_ORIGINS.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!corsOrigins.length || corsOrigins.includes('*'))
    throw new Error('Invalid environment configuration: CORS_ORIGINS must list explicit origins');
  const deviceAllowedCidrs = result.data.DEVICE_ALLOWED_CIDRS.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const { CORS_ORIGINS: _ignored, DEVICE_ALLOWED_CIDRS: _cidrs, ...rest } = result.data;
  void _ignored;
  void _cidrs;
  return { ...rest, corsOrigins, deviceAllowedCidrs };
};
