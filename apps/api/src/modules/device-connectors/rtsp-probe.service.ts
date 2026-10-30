import { createConnection } from 'node:net';
export interface RtspProbeResult {
  reachable: boolean;
  authenticated: boolean;
  streamAvailable: boolean;
  statusCode?: number;
  codecs: string[];
}
export class RtspProbeService {
  public async probe(input: {
    host: string;
    port: number;
    path: string;
    username: string;
    password: string;
    timeoutMs: number;
  }): Promise<RtspProbeResult> {
    const uri = `rtsp://${input.host}:${input.port}${input.path.startsWith('/') ? input.path : `/${input.path}`}`;
    const request = (authorization?: string) =>
      new Promise<string>((resolve, reject) => {
        const socket = createConnection({ host: input.host, port: input.port });
        let response = '';
        const timer = setTimeout(() => socket.destroy(new Error('RTSP timeout')), input.timeoutMs);
        socket.setEncoding('utf8');
        socket.on('connect', () =>
          socket.write(
            `DESCRIBE ${uri} RTSP/1.0\r\nCSeq: 1\r\nAccept: application/sdp\r\n${authorization ? `Authorization: ${authorization}\r\n` : ''}\r\n`,
          ),
        );
        socket.on('data', (chunk) => {
          response += chunk;
          if (response.includes('\r\n\r\n')) {
            clearTimeout(timer);
            socket.end();
            resolve(response);
          }
        });
        socket.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
    let response = await request();
    let code = Number(/^RTSP\/\d\.\d\s+(\d{3})/m.exec(response)?.[1] ?? 0);
    if (code === 401 && /WWW-Authenticate:\s*Basic/i.test(response)) {
      const auth = `Basic ${Buffer.from(`${input.username}:${input.password}`).toString('base64')}`;
      response = await request(auth);
      code = Number(/^RTSP\/\d\.\d\s+(\d{3})/m.exec(response)?.[1] ?? 0);
    }
    const codecs = [...response.matchAll(/a=rtpmap:\d+\s+([^/\r\n]+)/gi)]
      .map((match) => match[1]!)
      .filter((value, index, all) => all.indexOf(value) === index);
    return {
      reachable: code > 0,
      authenticated: code !== 401,
      streamAvailable: code === 200 && /m=video/i.test(response),
      statusCode: code || undefined,
      codecs,
    };
  }
}
