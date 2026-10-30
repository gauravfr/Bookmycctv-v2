import { Cam } from 'onvif';
import type { Capability } from '../cameras/camera.model.js';
import type { ConnectionResult, ConnectorInput, DiscoveredProfile } from './connector.types.js';

interface OnvifProfile {
  $?: { token?: string };
  token?: string;
  name?: string;
  videoEncoderConfiguration?: {
    encoding?: string;
    resolution?: { width?: number; height?: number };
  };
  ptzConfiguration?: unknown;
  audioEncoderConfiguration?: unknown;
}
interface OnvifInformation {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
}
interface CamShape {
  profiles?: OnvifProfile[];
  getDeviceInformation(
    callback: (error: Error | null, information?: OnvifInformation) => void,
  ): void;
  getStreamUri(
    options: { protocol: string; profileToken?: string },
    callback: (error: Error | null, result?: { uri?: string }) => void,
  ): void;
  getSnapshotUri(
    options: { profileToken?: string },
    callback: (error: Error | null, result?: { uri?: string }) => void,
  ): void;
}
const call = <T>(invoke: (callback: (error: Error | null, value?: T) => void) => void) =>
  new Promise<T>((resolve, reject) =>
    invoke((error, value) =>
      error
        ? reject(error)
        : value === undefined
          ? reject(new Error('ONVIF returned no value'))
          : resolve(value),
    ),
  );
const capability = (state: Capability['state']): Capability => ({
  state,
  source: 'ONVIF',
  verifiedAt: new Date(),
});
export class OnvifConnector {
  public async connect(input: ConnectorInput): Promise<ConnectionResult> {
    const warnings: string[] = [];
    const cam = await new Promise<CamShape>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('ONVIF connection timeout')),
        input.timeoutMs,
      );
      const instance = new Cam(
        {
          hostname: input.hostname,
          port: input.onvifPort,
          username: input.username,
          password: input.password,
          timeout: input.timeoutMs,
        },
        (error) => {
          clearTimeout(timer);
          if (error) reject(error);
          else resolve(instance as unknown as CamShape);
        },
      );
    });
    const information = await call<OnvifInformation>((cb) => cam.getDeviceInformation(cb));
    const profiles: DiscoveredProfile[] = [];
    for (const [index, profile] of (cam.profiles ?? []).entries()) {
      const token = profile.$?.token ?? profile.token;
      if (!token) {
        warnings.push(`Profile ${index + 1} has no token`);
        continue;
      }
      const stream = await call<{ uri?: string }>((cb) =>
        cam.getStreamUri({ protocol: 'RTSP', profileToken: token }, cb),
      ).catch(() => undefined);
      const snapshot = await call<{ uri?: string }>((cb) =>
        cam.getSnapshotUri({ profileToken: token }, cb),
      ).catch(() => undefined);
      profiles.push({
        token,
        name: profile.name,
        channelId: String(index + 1),
        codec: profile.videoEncoderConfiguration?.encoding,
        width: profile.videoEncoderConfiguration?.resolution?.width,
        height: profile.videoEncoderConfiguration?.resolution?.height,
        streamUri: stream?.uri,
        snapshotUri: snapshot?.uri,
        capabilities: {
          liveVideo: capability(stream?.uri ? 'SUPPORTED' : 'UNKNOWN'),
          ptz: capability(profile.ptzConfiguration ? 'SUPPORTED' : 'UNSUPPORTED'),
          snapshot: capability(snapshot?.uri ? 'SUPPORTED' : 'UNSUPPORTED'),
          audioInput: capability(profile.audioEncoderConfiguration ? 'SUPPORTED' : 'UNKNOWN'),
          events: capability('UNKNOWN'),
        },
      });
    }
    return {
      networkReachable: true,
      authenticationSuccessful: true,
      deviceInformationDiscovered: true,
      channelsDiscovered: profiles.length > 0,
      streamUriObtained: profiles.some((profile) => Boolean(profile.streamUri)),
      streamMediaVerified: false,
      device: information,
      profiles,
      warnings,
    };
  }
}
