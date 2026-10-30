import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from './api-error.js';
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
export const objectId = (value: string, name = 'id'): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value))
    throw new ApiError(400, 'INVALID_OBJECT_ID', `${name} is invalid`);
  return new Types.ObjectId(value);
};
export const routeParam = (req: Request, name: string): string => {
  const value = req.params[name];
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_PARAMETER', `${name} is invalid`);
  return value;
};
