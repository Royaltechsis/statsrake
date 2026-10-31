// Persistence seam. v1 keeps saved reports in the browser (localStorage).
// To move to a server later: add app/api/reports/route.ts that writes to Neon using
// process.env.DATABASE_URL (table reports(id text primary key, created_at timestamptz, body jsonb)),
// then swap LocalReportStore for an ApiReportStore that calls fetch('/api/reports').
export interface SavedReport { id: string; createdAt: string; title: string; hash: string; monthlyUSD: number }
export interface ReportStore { save(r: SavedReport): Promise<void>; list(): Promise<SavedReport[]> }

const KEY = 'wahala.reports.v1';
export class LocalReportStore implements ReportStore {
  async list() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as SavedReport[]; } catch { return []; } }
  async save(r: SavedReport) { const all = (await this.list()).filter(x => x.id !== r.id); all.unshift(r); localStorage.setItem(KEY, JSON.stringify(all.slice(0, 20))); }
}
export const store: ReportStore = new LocalReportStore();

export function encodeState(o: unknown): string {
  const s = JSON.stringify(o);
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeState<T>(h: string): T | null {
  try { const b = h.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b)))) as T; } catch { return null; }
}
