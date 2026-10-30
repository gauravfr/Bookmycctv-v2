declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
};
const api = process.env.GATEWAY_API_URL;
const enrollment = process.env.GATEWAY_ENROLLMENT_TOKEN;
let id = process.env.GATEWAY_ID,
  secret = process.env.GATEWAY_SECRET;
if (!api) throw new Error('GATEWAY_API_URL is required');
const post = async (path: string, body: unknown, authorization?: string) => {
  const r = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} failed (${r.status})`);
  return r.json() as Promise<{ data: Record<string, unknown> }>;
};
if ((!id || !secret) && enrollment) {
  const result = await post('/api/v1/gateway/enroll', {
    enrollmentToken: enrollment,
    capabilities: ['HEARTBEAT'],
  });
  id = String(result.data.gatewayId);
  secret = String(result.data.gatewaySecret);
  process.stdout.write(
    `Enrollment succeeded. Store GATEWAY_ID=${id} and GATEWAY_SECRET securely, then remove GATEWAY_ENROLLMENT_TOKEN.\n`,
  );
}
if (!id || !secret) throw new Error('GATEWAY_ID and GATEWAY_SECRET are required after enrollment');
const beat = async () => {
  await post(
    '/api/v1/gateway/heartbeat',
    { capabilities: ['HEARTBEAT'] },
    `Gateway ${id}.${secret}`,
  );
};
await beat();
setInterval(
  () =>
    void beat().catch((e) =>
      process.stderr.write(`${e instanceof Error ? e.message : 'heartbeat failed'}\n`),
    ),
  30000,
);
