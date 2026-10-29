// Plan morning-digest, section 1. The shapes every part of section 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

export const RUN_STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// One line of runs/<night>.jsonl, after parsing at the edge.
export type RunLine = {
  at: string; // as logged, with its offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for a night.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null in the data; views render `—`
  runs: number; // parsed lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus; // from the job's last line in file order
  lastError: string | null; // `error` of the job's last line, null when it has none
  firstAt: string; // `at` of the job's first line, as logged
  lastAt: string; // `at` of the job's last line, as logged
};

// A night as read from disk. Rows are sorted by job (plain string sort).
export type Night = {
  night: string; // YYYY-MM-DD, the file name without `.jsonl`
  rows: DigestRow[];
  badLines: number; // lines that did not parse or did not fit RunLine; counted, never thrown
};

// Per-night counts of each job's last status, for the board.
export type StatusCounts = Record<RunStatus, number>;

// readNight(runsDir, night): reads `<runsDir>/<night>.jsonl`.
// Returns null when the file does not exist; an empty file gives `rows: []`.
// Implemented in `./read.ts`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
