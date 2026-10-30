import type { Response } from 'express';
export const sendSuccess = <T>(res: Response, status: number, data: T) =>
  res.status(status).json({ success: true, data, meta: { requestId: res.req.requestId } });
export const sendFailure = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  res.status(status).json({
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
    meta: { requestId: res.req.requestId },
  });
