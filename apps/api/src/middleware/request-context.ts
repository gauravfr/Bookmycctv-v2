import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
export const requestContext: RequestHandler = (req, res, next) => {
  const supplied = req.header('x-request-id');
  req.requestId = supplied && /^[A-Za-z0-9._-]{1,128}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};
