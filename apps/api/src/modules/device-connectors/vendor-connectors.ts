import type { DeviceBrand } from '../devices/device.model.js';
import type { ConnectionResult, ConnectorInput, DeviceConnector } from './connector.types.js';
import { OnvifConnector } from './onvif.connector.js';
import { RtspProbeService } from './rtsp-probe.service.js';
import { ApiError } from '../../utils/api-error.js';
abstract class StandardConnector implements DeviceConnector {
  public abstract readonly brand: DeviceBrand;
  public constructor(
    private readonly onvif: OnvifConnector,
    private readonly rtsp = new RtspProbeService(),
  ) {}
  public async connect(input: ConnectorInput): Promise<ConnectionResult> {
    try {
      return await this.onvif.connect(input);
    } catch (onvifError) {
      const path = this.fallbackRtspPath(input, 1, 0);
      if (!path)
        throw new ApiError(
          422,
          'ONVIF_UNAVAILABLE_RTSP_PATH_REQUIRED',
          'ONVIF failed and this model requires a custom RTSP path',
        );
      const probe = await this.rtsp.probe({
        host: input.hostname,
        port: input.rtspPort,
        path,
        username: input.username,
        password: input.password,
        timeoutMs: input.timeoutMs,
      });
      if (!probe.streamAvailable) {
        if (!probe.authenticated)
          throw new ApiError(401, 'DEVICE_AUTHENTICATION_FAILED', 'Device authentication failed');
        throw onvifError;
      }
      return {
        networkReachable: probe.reachable,
        authenticationSuccessful: probe.authenticated,
        deviceInformationDiscovered: false,
        channelsDiscovered: true,
        streamUriObtained: true,
        streamMediaVerified: true,
        device: {},
        profiles: [
          {
            token: 'rtsp-fallback-1',
            channelId: '1',
            streamUri: `rtsp://${input.hostname}:${input.rtspPort}${path}`,
            codec: probe.codecs[0],
            capabilities: {
              liveVideo: { state: 'SUPPORTED', source: 'RTSP_DESCRIBE', verifiedAt: new Date() },
              ptz: { state: 'UNKNOWN', source: 'RTSP_DESCRIBE', verifiedAt: new Date() },
              snapshot: { state: 'UNKNOWN', source: 'RTSP_DESCRIBE', verifiedAt: new Date() },
              audioInput: {
                state: probe.codecs.some((codec) => !/H26|JPEG/i.test(codec))
                  ? 'SUPPORTED'
                  : 'UNKNOWN',
                source: 'RTSP_DESCRIBE',
                verifiedAt: new Date(),
              },
              events: { state: 'UNKNOWN', source: 'RTSP_DESCRIBE', verifiedAt: new Date() },
            },
          },
        ],
        warnings: ['ONVIF discovery failed; capabilities are limited to RTSP negotiation'],
      };
    }
  }
  public abstract fallbackRtspPath(
    input: ConnectorInput,
    channel: number,
    subtype: number,
  ): string | undefined;
}
export class DahuaConnector extends StandardConnector {
  public readonly brand = 'DAHUA' as const;
  public fallbackRtspPath(input: ConnectorInput, channel: number, subtype: number) {
    return input.customRtspPath ?? `/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
  }
}
export class HikvisionConnector extends StandardConnector {
  public readonly brand = 'HIKVISION' as const;
  public fallbackRtspPath(input: ConnectorInput, channel: number, subtype: number) {
    return input.customRtspPath ?? `/Streaming/Channels/${channel}0${subtype + 1}`;
  }
}
export class CpPlusConnector extends StandardConnector {
  public readonly brand = 'CP_PLUS' as const;
  public fallbackRtspPath(input: ConnectorInput) {
    return input.customRtspPath;
  }
}
export class ConnectorRegistry {
  private readonly connectors: Map<DeviceBrand, DeviceConnector>;
  public constructor(onvif = new OnvifConnector()) {
    const list = [
      new DahuaConnector(onvif),
      new CpPlusConnector(onvif),
      new HikvisionConnector(onvif),
    ];
    this.connectors = new Map(list.map((connector) => [connector.brand, connector]));
  }
  public get(brand: DeviceBrand): DeviceConnector {
    const connector = this.connectors.get(brand);
    if (!connector) throw new Error(`Unsupported device brand: ${brand}`);
    return connector;
  }
}
