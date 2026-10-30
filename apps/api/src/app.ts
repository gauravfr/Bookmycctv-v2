import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { AppLogger } from './config/logger.js';
import type { DatabaseHealth } from './database/mongodb.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { createApiRouter } from './routes/api.js';
import { AuditService } from './modules/alerts/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { PasswordService } from './modules/auth/password.service.js';
import { TokenService } from './modules/auth/token.service.js';
import { authenticate } from './middleware/auth.js';
import { createPlatformRouter } from './modules/organizations/platform.routes.js';
import { createAdminRouter } from './modules/users/admin.routes.js';
import { MongoCameraResourceValidator } from './modules/cameras/camera-resource.js';
import { createClientRouter } from './modules/cameras/client.routes.js';
import { CredentialCryptoService } from './modules/devices/credential-crypto.service.js';
import { NetworkPolicyService } from './modules/devices/network-policy.service.js';
import { ConnectorRegistry } from './modules/device-connectors/vendor-connectors.js';
import { DeviceService } from './modules/devices/device.service.js';
import { createDeviceAdminRouter } from './modules/devices/device.routes.js';
import { createDeviceMetadataRouter } from './modules/devices/device-metadata.routes.js';
import { createCameraRouter } from './modules/cameras/camera.routes.js';
import { CameraAccessService } from './modules/cameras/camera-access.service.js';
import { GatewayService } from './modules/gateways/gateway.service.js';
import {
  createGatewayAdminRouter,
  createGatewayServiceRouter,
} from './modules/gateways/gateway.routes.js';
import { MediaMtxGateway } from './modules/streams/media-gateway.service.js';
import { StreamService } from './modules/streams/stream.service.js';
import { createMediaAuthRouter, createStreamRouter } from './modules/streams/stream.routes.js';
import { CameraControlService } from './modules/cameras/camera-control.service.js';
import { createCameraControlRouter } from './modules/cameras/camera-control.routes.js';
import { EventPipelineService } from './modules/security-events/event-pipeline.service.js';
import {
  createAlertAdminRouter,
  createSecurityEventRouter,
} from './modules/security-events/security-event.routes.js';
import { NotificationService } from './modules/notifications/notification.service.js';
import { createNotificationRouter } from './modules/notifications/notification.routes.js';
import {
  createDetectorAdminRouter,
  createTrustedIngestionRouter,
} from './modules/detectors/detector.routes.js';
import { JobRunner } from './modules/jobs/job-runner.service.js';

export const createApp = ({
  config,
  database,
  logger,
}: {
  config: AppConfig;
  database: DatabaseHealth;
  logger: AppLogger;
}): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.use(requestContext);
  app.use(pinoHttp({ logger, genReqId: (req) => req.requestId }));
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, cb) {
        if (origin === undefined || config.corsOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Origin is not allowed by CORS'));
      },
    }),
  );
  app.use(express.json({ limit: config.JSON_BODY_LIMIT }));
  app.use(
    rateLimit({
      windowMs: config.API_RATE_LIMIT_WINDOW_MS,
      limit: config.API_RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.path.endsWith('/health') || req.path.endsWith('/ready'),
    }),
  );
  app.use('/api/v1', createApiRouter(database));
  const audit = new AuditService();
  const passwords = new PasswordService(config);
  const tokens = new TokenService(config);
  const auth = new AuthService(config, passwords, tokens, audit);
  const credentialCrypto = new CredentialCryptoService(config);
  const deviceService = new DeviceService(
    config,
    credentialCrypto,
    new NetworkPolicyService(config.deviceAllowedCidrs),
    new ConnectorRegistry(),
    audit,
  );
  const authLimiter = rateLimit({
    windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.use('/api/v1/auth', authLimiter, createAuthRouter(auth, tokens));
  app.use('/api/v1/platform', authenticate(tokens), createPlatformRouter(passwords, auth, audit));
  app.use(
    '/api/v1/admin',
    authenticate(tokens),
    createAdminRouter(passwords, auth, audit, new MongoCameraResourceValidator()),
  );
  app.use('/api/v1/admin', authenticate(tokens), createDeviceAdminRouter(deviceService, config));
  const gatewayService = new GatewayService(config);
  app.use('/api/v1/admin', authenticate(tokens), createGatewayAdminRouter(gatewayService, config));
  app.use('/api/v1/gateway', createGatewayServiceRouter(gatewayService));
  const cameraAccess = new CameraAccessService();
  const eventPipeline = new EventPipelineService(config);
  const notificationService = new NotificationService(config, credentialCrypto);
  const jobRunner = new JobRunner(config, notificationService, logger);
  jobRunner.start();
  app.use('/api/v1/admin', authenticate(tokens), createAlertAdminRouter(audit));
  app.use('/api/v1/admin', authenticate(tokens), createDetectorAdminRouter(jobRunner));
  app.use(
    '/api/v1/ingest',
    createTrustedIngestionRouter(config, gatewayService, eventPipeline, credentialCrypto),
  );
  app.use(
    '/api/v1/security-events',
    authenticate(tokens),
    createSecurityEventRouter(audit, config),
  );
  app.use('/api/v1', authenticate(tokens), createNotificationRouter(notificationService, audit));
  const streamService = new StreamService(
    config,
    cameraAccess,
    credentialCrypto,
    new MediaMtxGateway(config),
  );
  app.use('/api/v1', authenticate(tokens), createStreamRouter(streamService));
  app.use('/api/v1/media', createMediaAuthRouter(streamService));
  app.use('/api/v1/devices', authenticate(tokens), createDeviceMetadataRouter());
  app.use('/api/v1/cameras', authenticate(tokens), createCameraRouter());
  app.use(
    '/api/v1/cameras',
    authenticate(tokens),
    createCameraControlRouter(new CameraControlService(config, cameraAccess, credentialCrypto)),
  );
  app.use('/api/v1/client', authenticate(tokens), createClientRouter());
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger, config.NODE_ENV === 'production'));
  return app;
};
