import { api } from './bookmycctv-api';
import type { StreamDescriptor } from '@/types/domain';
export class StreamController {
  private descriptor: StreamDescriptor | null = null;
  public async start(cameraId: string): Promise<StreamDescriptor> {
    await this.stop();
    const stream = await api.createStream(cameraId, 'HLS');
    if (stream.status !== 'READY' || !stream.endpoint || !stream.authorization?.token) {
      await api.revokeStream(stream.sessionId).catch(() => undefined);
      throw new Error(stream.diagnosticCode ?? 'Playable HLS endpoint is unavailable');
    }
    this.descriptor = stream;
    return stream;
  }
  public current() {
    return this.descriptor;
  }
  public async stop(): Promise<void> {
    const session = this.descriptor;
    this.descriptor = null;
    if (session) await api.revokeStream(session.sessionId).catch(() => undefined);
  }
}
