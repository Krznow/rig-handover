import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUN_STATUSES, type DigestRow, type Night, type ReadNight, type RunLine, type RunStatus, type StatusCounts } from './types.js';

function isRunStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (RUN_STATUSES as readonly string[]).includes(v);
}

// The edge: one raw line in, a RunLine or null (a bad line) out.
export function parseLine(line: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isRunStatus(o.status)) return null;
  const owner = o.owner === undefined ? null : o.owner;
  if (owner !== null && typeof owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  const parsed: RunLine = { at: o.at, job: o.job, status: o.status, owner };
  if (typeof o.error === 'string') parsed.error = o.error;
  return parsed;
}

// Pure: file text in, rows and bad-line count out. Blank lines are skipped, not counted.
export function digestText(night: string, text: string): Night {
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const r = parseLine(line);
    if (r === null) {
      badLines++;
      continue;
    }
    const row = byJob.get(r.job);
    if (row === undefined) {
      byJob.set(r.job, {
        job: r.job,
        owner: r.owner,
        runs: 1,
        retries: r.status === 'retry' ? 1 : 0,
        lastStatus: r.status,
        lastError: r.error ?? null,
        firstAt: r.at,
        lastAt: r.at,
      });
    } else {
      row.runs++;
      if (r.status === 'retry') row.retries++;
      row.lastStatus = r.status;
      row.lastError = r.error ?? null;
      row.lastAt = r.at;
      if (r.owner !== null) row.owner = r.owner;
    }
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  return digestText(night, text);
};

// Counts each job's last status: { ok, retry, fail } for one night's rows.
export function countStatuses(rows: readonly DigestRow[]): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const r of rows) counts[r.lastStatus]++;
  return counts;
}
