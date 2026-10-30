import { z } from 'zod';
import { connectionMethods, deviceBrands, deviceTypes } from './device.model.js';
const port = z.number().int().min(1).max(65535);
const deviceRegistrationBase = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    brand: z.enum(deviceBrands),
    deviceType: z.enum(deviceTypes),
    connectionMethod: z.enum(connectionMethods),
    hostname: z.string().trim().min(1).max(253).optional(),
    publicEndpoint: z.string().trim().max(253).optional(),
    gatewayId: z.string().optional(),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    rtspPort: port.default(554),
    httpPort: port.default(80),
    onvifPort: port.default(80),
    vendorPort: port.optional(),
    model: z.string().trim().max(120).optional(),
    serialNumber: z.string().trim().max(120).optional(),
    firmwareVersion: z.string().trim().max(120).optional(),
    customRtspPath: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => !value.includes('@') && !value.includes('://'),
        'must be a path without credentials',
      )
      .optional(),
    streamTransport: z.enum(['TCP', 'UDP']).default('TCP'),
    tlsEnabled: z.boolean().default(false),
    tlsVerify: z.boolean().default(true),
  })
  .strict();
export const deviceRegistrationSchema = deviceRegistrationBase.superRefine((value, context) => {
  if (value.connectionMethod === 'LOCAL_LAN' && !value.hostname)
    context.addIssue({
      code: 'custom',
      path: ['hostname'],
      message: 'hostname is required for LOCAL_LAN',
    });
  if (value.connectionMethod === 'SECURE_GATEWAY' && !value.gatewayId)
    context.addIssue({
      code: 'custom',
      path: ['gatewayId'],
      message: 'gatewayId is required for SECURE_GATEWAY',
    });
});
export const deviceUpdateSchema = deviceRegistrationBase
  .omit({ brand: true, deviceType: true, connectionMethod: true })
  .partial()
  .strict();
export const fieldDefinitionQuery = z.object({
  brand: z.enum(deviceBrands),
  type: z.enum(deviceTypes),
  method: z.enum(connectionMethods),
});
export const fieldDefinitions = (brand: string, type: string, method: string) => ({
  brand,
  type,
  method,
  fields: [
    {
      name: 'displayName',
      required: true,
      type: 'string',
      constraints: { minLength: 2, maxLength: 120 },
    },
    {
      name: 'hostname',
      required: method === 'LOCAL_LAN',
      type: 'hostname',
      description: 'Approved device hostname or IPv4 address',
    },
    { name: 'gatewayId', required: method === 'SECURE_GATEWAY', type: 'objectId' },
    { name: 'username', required: true, type: 'string', secret: true },
    { name: 'password', required: true, type: 'password', secret: true },
    { name: 'rtspPort', required: true, type: 'port', default: 554 },
    { name: 'onvifPort', required: true, type: 'port', default: 80 },
    { name: 'httpPort', required: true, type: 'port', default: 80 },
    {
      name: 'customRtspPath',
      required: brand === 'CP_PLUS',
      type: 'path',
      description:
        'Optional for ONVIF-discovered streams; recommended for model-specific CP Plus RTSP',
    },
  ],
});
