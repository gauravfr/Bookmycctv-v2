import { Router } from 'express';
import type { DatabaseHealth } from '../database/mongodb.js';
import { sendFailure, sendSuccess } from '../utils/responses.js';
export const createApiRouter = (database: DatabaseHealth): Router => {
  const router = Router();
  router.get('/', (_req, res) =>
    sendSuccess(res, 200, { name: 'BookMyCCTV', apiVersion: 'v1', message: 'API is operational' }),
  );
  router.get('/health', (_req, res) =>
    sendSuccess(res, 200, {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  );
  router.get('/ready', (_req, res) =>
    database.isReady()
      ? sendSuccess(res, 200, { status: 'ready', dependencies: { mongodb: 'ready' } })
      : sendFailure(res, 503, 'SERVICE_UNAVAILABLE', 'Required dependencies are not ready'),
  );
  return router;
};
