import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ApiError } from '../../utils/api-error.js';

const ipv4Number = (ip: string) =>
  ip.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
const inCidr = (ip: string, cidr: string): boolean => {
  const [base, bitsText] = cidr.split('/');
  if (!base || isIP(base) !== 4 || isIP(ip) !== 4) return false;
  const bits = Number(bitsText ?? 32);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask);
};
const forbidden = ['0.0.0.0/8', '127.0.0.0/8', '169.254.0.0/16', '224.0.0.0/4'];
export class NetworkPolicyService {
  public constructor(private readonly allowedCidrs: string[]) {}
  public async assertAllowed(hostname: string): Promise<string[]> {
    if (!hostname || hostname.includes('/') || hostname.includes('@') || hostname.includes(':'))
      throw new ApiError(400, 'INVALID_DEVICE_ENDPOINT', 'Device hostname is invalid');
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true, verbatim: true }).catch(() => {
          throw new ApiError(400, 'DEVICE_DNS_FAILED', 'Device hostname could not be resolved');
        });
    if (!addresses.length)
      throw new ApiError(400, 'DEVICE_DNS_FAILED', 'Device hostname could not be resolved');
    for (const { address, family } of addresses) {
      if (
        family !== 4 ||
        forbidden.some((cidr) => inCidr(address, cidr)) ||
        !this.allowedCidrs.some((cidr) => inCidr(address, cidr))
      )
        throw new ApiError(
          403,
          'DEVICE_DESTINATION_DENIED',
          'Device destination is outside approved network ranges',
        );
    }
    return addresses.map(({ address }) => address);
  }
}
export const cidrContains = inCidr;
