import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { connectionMethods, deviceBrands, deviceTypes } from './device.model.js';
import { fieldDefinitionQuery, fieldDefinitions } from './device.schemas.js';
export const createDeviceMetadataRouter = (): Router => {
  const router = Router();
  router.get('/brands', (_req, res) =>
    sendSuccess(res, 200, { brands: deviceBrands, deviceTypes, connectionMethods }),
  );
  router.get(
    '/field-definitions',
    asyncHandler(async (req, res) => {
      const query = fieldDefinitionQuery.parse(req.query);
      return sendSuccess(res, 200, fieldDefinitions(query.brand, query.type, query.method));
    }),
  );
  return router;
};
