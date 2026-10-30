import { describe, expect, it } from 'vitest';
import { isAfterHours } from '../src/modules/security-events/event-pipeline.service.js';
const rule = (
  timeZone: string,
  start: string,
  end: string,
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) => ({ timeZone, schedule: { start, end, days, holidays } });
describe('alert schedules', () => {
  it('recognizes activity inside normal working hours', () => {
    expect(
      isAfterHours(new Date('2026-10-19T06:30:00Z'), rule('Asia/Kolkata', '09:00', '18:00')),
    ).toBe(false);
  });
  it('recognizes activity after normal working hours', () => {
    expect(
      isAfterHours(new Date('2026-10-19T14:00:00Z'), rule('Asia/Kolkata', '09:00', '18:00')),
    ).toBe(true);
  });
  it('supports overnight windows', () => {
    expect(isAfterHours(new Date('2026-10-19T23:00:00Z'), rule('UTC', '22:00', '06:00'))).toBe(
      false,
    );
    expect(isAfterHours(new Date('2026-10-19T12:00:00Z'), rule('UTC', '22:00', '06:00'))).toBe(
      true,
    );
  });
  it('treats configured holidays as after hours', () => {
    expect(
      isAfterHours(
        new Date('2026-10-19T12:00:00Z'),
        rule('UTC', '09:00', '18:00', [1], ['2026-10-19']),
      ),
    ).toBe(true);
  });
  it('uses IANA timezone conversion across daylight-saving changes', () => {
    const ny = rule('America/New_York', '09:00', '18:00', [0]);
    expect(isAfterHours(new Date('2026-03-08T14:30:00Z'), ny)).toBe(false);
  });
});
