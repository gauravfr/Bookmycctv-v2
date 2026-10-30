import { Cam } from 'onvif';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type { UserDocument } from '../users/user.model.js';
import type { Types } from 'mongoose';
import type { CameraAccessService } from './camera-access.service.js';
import { capabilityValue } from './camera.model.js';
import { DeviceModel } from '../devices/device.model.js';
import type { CredentialCryptoService } from '../devices/credential-crypto.service.js';
type Callback = (error: Error | null, value?: unknown) => void;
interface PtzCam {
  continuousMove(options: unknown, cb: Callback): void;
  stop(options: unknown, cb: Callback): void;
  getPresets(options: unknown, cb: Callback): void;
  gotoPreset(options: unknown, cb: Callback): void;
}
const invoke = (fn: (cb: Callback) => void) =>
  new Promise<unknown>((resolve, reject) => fn((e, v) => (e ? reject(e) : resolve(v))));
export class CameraControlService {
  private readonly locks = new Set<string>();
  public constructor(
    private readonly config: AppConfig,
    private readonly access: CameraAccessService,
    private readonly crypto: CredentialCryptoService,
  ) {}
  private async context(
    user: UserDocument,
    cameraId: Types.ObjectId,
    permission: 'camera:ptz' | 'camera:snapshot',
  ) {
    const camera = await this.access.require(user, cameraId, permission);
    const cap = capabilityValue(
      camera.capabilities,
      permission === 'camera:ptz' ? 'ptz' : 'snapshot',
    );
    if (!cap || cap.state !== 'SUPPORTED')
      throw new ApiError(
        422,
        permission === 'camera:ptz' ? 'PTZ_UNSUPPORTED' : 'SNAPSHOT_UNSUPPORTED',
        'Camera capability is not verified as supported',
      );
    const device = await DeviceModel.findOne({
      _id: camera.deviceId,
      organizationId: user.organizationId,
    }).select('+usernameEncrypted +passwordEncrypted');
    if (!device?.hostname)
      throw new ApiError(503, 'CAMERA_CONNECTION_UNAVAILABLE', 'Camera connection is unavailable');
    return {
      camera,
      device,
      username: this.crypto.decrypt(device.usernameEncrypted),
      password: this.crypto.decrypt(device.passwordEncrypted),
    };
  }
  private connect(hostname: string, port: number, username: string, password: string) {
    return new Promise<PtzCam>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new ApiError(504, 'CAMERA_CONTROL_TIMEOUT', 'Camera control connection timed out'),
          ),
        this.config.DEVICE_CONNECT_TIMEOUT_MS,
      );
      const instance = new Cam(
        { hostname, port, username, password, timeout: this.config.DEVICE_CONNECT_TIMEOUT_MS },
        (error) => {
          clearTimeout(timer);
          if (error)
            reject(
              new ApiError(502, 'CAMERA_CONTROL_FAILED', 'Camera rejected the control connection'),
            );
          else resolve(instance as unknown as PtzCam);
        },
      );
    });
  }
  public async move(
    user: UserDocument,
    id: Types.ObjectId,
    input: { x: number; y: number; zoom: number; durationMs: number },
  ) {
    const key = id.toString();
    if (this.locks.has(key)) throw new ApiError(409, 'PTZ_BUSY', 'Another PTZ command is active');
    this.locks.add(key);
    try {
      const c = await this.context(user, id, 'camera:ptz');
      const cam = await this.connect(
        c.device.hostname!,
        c.device.onvifPort,
        c.username,
        c.password,
      );
      const profileToken = c.camera.profiles[0]?.token;
      if (!profileToken) throw new ApiError(422, 'PTZ_UNSUPPORTED', 'Camera has no ONVIF profile');
      await invoke((cb) =>
        cam.continuousMove(
          { profileToken, velocity: { x: input.x, y: input.y, zoom: input.zoom } },
          cb,
        ),
      );
      await new Promise((r) => setTimeout(r, input.durationMs));
      await invoke((cb) => cam.stop({ profileToken, panTilt: true, zoom: true }, cb));
      return { acknowledged: true, stopped: true };
    } finally {
      this.locks.delete(key);
    }
  }
  public async stop(user: UserDocument, id: Types.ObjectId) {
    const c = await this.context(user, id, 'camera:ptz');
    const cam = await this.connect(c.device.hostname!, c.device.onvifPort, c.username, c.password);
    await invoke((cb) =>
      cam.stop({ profileToken: c.camera.profiles[0]?.token, panTilt: true, zoom: true }, cb),
    );
    this.locks.delete(id.toString());
    return { acknowledged: true };
  }
  public async presets(user: UserDocument, id: Types.ObjectId) {
    const c = await this.context(user, id, 'camera:ptz');
    const cam = await this.connect(c.device.hostname!, c.device.onvifPort, c.username, c.password);
    return invoke((cb) => cam.getPresets({ profileToken: c.camera.profiles[0]?.token }, cb));
  }
  public async gotoPreset(user: UserDocument, id: Types.ObjectId, preset: string) {
    const c = await this.context(user, id, 'camera:ptz');
    const cam = await this.connect(c.device.hostname!, c.device.onvifPort, c.username, c.password);
    await invoke((cb) =>
      cam.gotoPreset({ profileToken: c.camera.profiles[0]?.token, presetToken: preset }, cb),
    );
    return { acknowledged: true };
  }
  public async snapshot(user: UserDocument, id: Types.ObjectId) {
    const c = await this.context(user, id, 'camera:snapshot');
    const encrypted = c.camera.profiles[0]?.snapshotUriEncrypted;
    if (!encrypted)
      throw new ApiError(422, 'SNAPSHOT_UNSUPPORTED', 'Camera has no ONVIF snapshot URI');
    const uri = new URL(this.crypto.decrypt(encrypted as never));
    const response = await fetch(uri, {
      headers: {
        authorization: `Basic ${Buffer.from(`${c.username}:${c.password}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(this.config.DEVICE_CONNECT_TIMEOUT_MS),
    }).catch(() => {
      throw new ApiError(502, 'SNAPSHOT_UNAVAILABLE', 'Snapshot could not be obtained');
    });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/jpeg', 'image/png'].includes(type ?? ''))
      throw new ApiError(502, 'SNAPSHOT_INVALID', 'Camera returned an invalid snapshot');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > this.config.SNAPSHOT_MAX_BYTES)
      throw new ApiError(413, 'SNAPSHOT_TOO_LARGE', 'Snapshot exceeds the configured size limit');
    return { data, type: type! };
  }
}
