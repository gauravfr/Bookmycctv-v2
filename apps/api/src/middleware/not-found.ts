import type { RequestHandler } from 'express';
import { sendFailure } from '../utils/responses.js';
export const notFoundHandler: RequestHandler = (req, res) => {
  sendFailure(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} was not found`);
};
