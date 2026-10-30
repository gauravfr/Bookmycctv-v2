import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { testConfig, testLogger } from './helpers.js';
const makeApp = (ready: boolean) =>
  createApp({ config: testConfig, database: { isReady: () => ready }, logger: testLogger });

describe('API foundation', () => {
  it('reports process health with security headers', async () => {
    const res = await request(makeApp(false)).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('healthy');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
  it('reports readiness when MongoDB is available', async () => {
    const res = await request(makeApp(true)).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.dependencies.mongodb).toBe('ready');
  });
  it('returns 503 when MongoDB is unavailable', async () => {
    const res = await request(makeApp(false)).get('/api/v1/ready');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
  it('returns API metadata', async () => {
    const res = await request(makeApp(true)).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'BookMyCCTV', apiVersion: 'v1' });
  });
  it('returns the standard structure for unknown routes', async () => {
    const res = await request(makeApp(true)).get('/missing');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
      meta: { requestId: expect.any(String) },
    });
  });
  it('returns a safe standard unexpected-error response', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = 'test-id';
      next(new Error('boom'));
    });
    app.use(createErrorHandler(testLogger, true));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  });
});
