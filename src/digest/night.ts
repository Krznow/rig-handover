// A night is a YYYY-MM-DD file name. Checked at the edge; also keeps path traversal out.
export function isNight(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
