import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const GOOD_LINE = '{"at":"2026-01-02T01:00:00+01:00","job":"temp/good-job","status":"ok","owner":"rook"}';

let tmpConfig = config;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(join(dir, '2026-01-02.jsonl'), `${GOOD_LINE}\nnot json\n`);
  tmpConfig = { ...config, runsDir: dir };
});

describe('GET /digest/:night', () => {
  it('renders 2026-10-28 with its jobs and errors', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('quota exceeded');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-03');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await createApp(tmpConfig).request('/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders 200 with the good line when another line is bad', async () => {
    const res = await createApp(tmpConfig).request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('temp/good-job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns JSON for 2026-10-28 with counts and bad lines', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('json');
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number; counts: unknown };
    expect(body.badLines).toBe(1);
    expect(body.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(body.rows.map((r) => r.job)).toEqual(readNight('runs', '2026-10-28')!.rows.map((r) => r.job));
  });

  it('lists the same jobs in the same order as the page', async () => {
    const app = createApp(config);
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: { job: string }[] };
    const html = await (await app.request('/digest/2026-10-28')).text();
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBeGreaterThan(0);
    const positions = jobs.map((j) => html.indexOf(j));
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(0);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-03');
    expect(res.status).toBe(404);
  });

  it('gives rows [] for the empty night', async () => {
    const res = await createApp(tmpConfig).request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line and keeps the good row', async () => {
    const res = await createApp(tmpConfig).request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]!.job).toBe('temp/good-job');
  });
});
