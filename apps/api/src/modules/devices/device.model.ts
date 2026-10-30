import { Schema, model, type Types } from 'mongoose';
export const deviceBrands = ['DAHUA', 'CP_PLUS', 'HIKVISION'] as const;
export const deviceTypes = ['IP_CAMERA', 'DVR', 'NVR', 'XVR'] as const;
export const connectionMethods = ['LOCAL_LAN', 'SECURE_GATEWAY', 'VENDOR_CLOUD'] as const;
export const connectionStates = [
  'UNKNOWN',
  'CONNECTING',
  'ONLINE',
  'DEGRADED',
  'OFFLINE',
  'GATEWAY_NOT_READY',
] as const;
export type DeviceBrand = (typeof deviceBrands)[number];
export type DeviceType = (typeof deviceTypes)[number];
export type ConnectionMethod = (typeof connectionMethods)[number];
export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}
export interface DeviceRecord {
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  displayName: string;
  brand: DeviceBrand;
  deviceType: DeviceType;
  connectionMethod: ConnectionMethod;
  hostname?: string;
  publicEndpoint?: string;
  gatewayId?: Types.ObjectId;
  usernameEncrypted: EncryptedValue;
  passwordEncrypted: EncryptedValue;
  rtspPort: number;
  httpPort: number;
  onvifPort: number;
  vendorPort?: number;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  customRtspPath?: string;
  streamTransport: 'TCP' | 'UDP';
  tlsEnabled: boolean;
  tlsVerify: boolean;
  connectionState: (typeof connectionStates)[number];
  lastSuccessfulConnectionAt?: Date;
  lastConnectionErrorCategory?: string;
  lastHealthCheckAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const encryptedSchema = new Schema<EncryptedValue>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyId: { type: String, required: true },
  },
  { _id: false },
);
const schema = new Schema<DeviceRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    displayName: { type: String, required: true, trim: true },
    brand: { type: String, enum: deviceBrands, required: true },
    deviceType: { type: String, enum: deviceTypes, required: true },
    connectionMethod: { type: String, enum: connectionMethods, required: true },
    hostname: String,
    publicEndpoint: String,
    gatewayId: Schema.Types.ObjectId,
    usernameEncrypted: { type: encryptedSchema, required: true, select: false },
    passwordEncrypted: { type: encryptedSchema, required: true, select: false },
    rtspPort: { type: Number, min: 1, max: 65535, default: 554 },
    httpPort: { type: Number, min: 1, max: 65535, default: 80 },
    onvifPort: { type: Number, min: 1, max: 65535, default: 80 },
    vendorPort: { type: Number, min: 1, max: 65535 },
    model: String,
    serialNumber: String,
    firmwareVersion: String,
    customRtspPath: String,
    streamTransport: { type: String, enum: ['TCP', 'UDP'], default: 'TCP' },
    tlsEnabled: { type: Boolean, default: false },
    tlsVerify: { type: Boolean, default: true },
    connectionState: { type: String, enum: connectionStates, default: 'UNKNOWN' },
    lastSuccessfulConnectionAt: Date,
    lastConnectionErrorCategory: String,
    lastHealthCheckAt: Date,
    deletedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, deletedAt: 1, createdAt: -1 });
schema.index({ organizationId: 1, serialNumber: 1 }, { unique: true, sparse: true });
export const DeviceModel = model<DeviceRecord>('Device', schema);
export const safeDevice = (device: DeviceRecord & { _id: Types.ObjectId }) => ({
  id: device._id.toString(),
  organizationId: device.organizationId.toString(),
  displayName: device.displayName,
  brand: device.brand,
  deviceType: device.deviceType,
  connectionMethod: device.connectionMethod,
  hostname: device.hostname,
  publicEndpoint: device.publicEndpoint,
  gatewayId: device.gatewayId?.toString() ?? null,
  ports: {
    rtsp: device.rtspPort,
    http: device.httpPort,
    onvif: device.onvifPort,
    vendor: device.vendorPort ?? null,
  },
  model: device.model ?? null,
  serialNumber: device.serialNumber ?? null,
  firmwareVersion: device.firmwareVersion ?? null,
  streamTransport: device.streamTransport,
  tlsEnabled: device.tlsEnabled,
  tlsVerify: device.tlsVerify,
  connectionState: device.connectionState,
  lastSuccessfulConnectionAt: device.lastSuccessfulConnectionAt ?? null,
  lastConnectionErrorCategory: device.lastConnectionErrorCategory ?? null,
  lastHealthCheckAt: device.lastHealthCheckAt ?? null,
  createdAt: device.createdAt,
  updatedAt: device.updatedAt,
});
