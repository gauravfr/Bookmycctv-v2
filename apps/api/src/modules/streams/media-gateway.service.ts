import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
export interface MediaPathHealth {
  online: boolean;
  tracks: string[];
  bytesReceived?: number;
}
export interface MediaGateway {
  provision(path: string, source: string): Promise<MediaPathHealth>;
  health(path: string): Promise<MediaPathHealth>;
  remove(path: string): Promise<void>;
  playback(path: string, transport: 'WEBRTC' | 'HLS'): string;
}
export class MediaMtxGateway implements MediaGateway {
  private readonly auth: string;
  public constructor(private readonly config: AppConfig) {
    this.auth = `Basic ${Buffer.from(`${config.MEDIA_GATEWAY_API_USER}:${config.MEDIA_GATEWAY_API_PASSWORD}`).toString('base64')}`;
  }
  private async request(path: string, init?: RequestInit) {
    if (!this.config.MEDIA_GATEWAY_ENABLED)
      throw new ApiError(503, 'MEDIA_GATEWAY_DISABLED', 'Media gateway is not enabled');
    const response = await fetch(`${this.config.MEDIA_GATEWAY_API_URL}${path}`, {
      ...init,
      headers: {
        authorization: this.auth,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(this.config.STREAM_START_TIMEOUT_MS),
    }).catch(() => {
      throw new ApiError(503, 'MEDIA_GATEWAY_UNAVAILABLE', 'Media gateway is unavailable');
    });
    if (!response.ok)
      throw new ApiError(
        503,
        'MEDIA_GATEWAY_REJECTED',
        'Media gateway could not provision the stream',
      );
    return response.status === 204 ? {} : response.json();
  }
  public async provision(path: string, source: string) {
    const existing = await this.health(path).catch(() => undefined);
    if (existing?.online && existing.tracks.length) return existing;
    await this.request(`/v3/config/paths/add/${encodeURIComponent(path)}`, {
      method: 'POST',
      body: JSON.stringify({
        source,
        sourceOnDemand: true,
        sourceOnDemandStartTimeout: `${this.config.STREAM_START_TIMEOUT_MS}ms`,
        rtspTransport: 'tcp',
      }),
    });
    const deadline = Date.now() + this.config.STREAM_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const h = await this.health(path).catch(() => ({ online: false, tracks: [] }));
      if (h.online && h.tracks.length) return h;
      await new Promise((r) => setTimeout(r, 350));
    }
    await this.remove(path).catch(() => undefined);
    throw new ApiError(
      503,
      'STREAM_SOURCE_NOT_READY',
      'No media packets were confirmed before the startup timeout',
    );
  }
  public async health(path: string) {
    const body = (await this.request(`/v3/paths/get/${encodeURIComponent(path)}`)) as {
      online?: boolean;
      tracks?: string[];
      bytesReceived?: number;
    };
    return {
      online: body.online === true,
      tracks: body.tracks ?? [],
      bytesReceived: body.bytesReceived,
    };
  }
  public async remove(path: string) {
    await this.request(`/v3/config/paths/delete/${encodeURIComponent(path)}`, { method: 'DELETE' });
  }
  public playback(path: string, transport: 'WEBRTC' | 'HLS') {
    return transport === 'HLS'
      ? `${this.config.MEDIA_GATEWAY_PUBLIC_HLS_URL}/${path}/index.m3u8`
      : `${this.config.MEDIA_GATEWAY_PUBLIC_WEBRTC_URL}/${path}/whep`;
  }
}
