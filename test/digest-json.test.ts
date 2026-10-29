import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the night as read, same jobs in the same order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as NonNullable<ReturnType<typeof readNight>>;
    expect(body.rows.map((r) => r.job)).toEqual(readNight('runs', '2026-10-28')!.rows.map((r) => r.job));
    expect(body.badLines).toBe(1);
    expect(body.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('404s for a night with no file and for a bad night', async () => {
    for (const path of ['/api/digest/1999-01-01', '/api/digest/..%2fpackage', '/api/digest/..']) {
      const res = await createApp(config).request(path);
      expect(res.status).toBe(404);
      if (!path.endsWith('/..')) expect(await res.json()).toEqual({ error: 'no such night' }); // '..' is folded away by URL parsing and never reaches the route
    }
  });
});
