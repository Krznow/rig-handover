import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countStatuses, digestText, readNight } from '../src/digest/read.js';

describe('readNight', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 2026-10-28 into 5 jobs and 1 bad line, sorted by job', () => {
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, takes the last status', () => {
    const row = night!.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });
    expect(row!.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row!.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });

  it('keeps the last error of a failed job', () => {
    const row = night!.rows.find((r) => r.job === 'notes/backup');
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row whose owner is null', () => {
    expect(night!.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('keeps times as logged, offset included', () => {
    const row = night!.rows.find((r) => r.job === 'rig/rotate-logs');
    expect(row!.firstAt).toBe('2026-10-28T23:00:02+01:00');
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('gives zero rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts lines that parse but do not fit as bad', () => {
    const text = ['[1]', '{"at":"x","job":"a","status":"maybe","owner":null}', '{"at":"x","job":"a","status":"ok","owner":3}', 'null'].join('\n');
    expect(digestText('n', text)).toEqual({ night: 'n', rows: [], badLines: 4, counts: { ok: 0, retry: 0, fail: 0 } });
  });
});

describe('countStatuses', () => {
  it('counts each job by its last status', () => {
    expect(countStatuses(readNight('runs', '2026-10-28')!.rows)).toEqual({ ok: 4, retry: 0, fail: 1 });
  });
});
