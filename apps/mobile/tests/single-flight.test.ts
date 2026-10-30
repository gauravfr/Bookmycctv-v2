import { describe, expect, it, vi } from 'vitest';
import { SingleFlight } from '../src/utils/single-flight';
describe('SingleFlight', () => {
  it('shares one refresh operation across simultaneous callers', async () => {
    let resolve!: (value: string) => void;
    const task = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const gate = new SingleFlight<string>();
    const first = gate.run(task);
    const second = gate.run(task);
    expect(task).toHaveBeenCalledOnce();
    resolve('rotated-token');
    await expect(Promise.all([first, second])).resolves.toEqual(['rotated-token', 'rotated-token']);
  });
});
