import { DATA } from './plans';
import type { Inputs, NetworkProfile } from './types';

/** Rough page load estimate: connection setup round trips plus transfer at ~75% of the advertised speed. */
export function loadSeconds(p: NetworkProfile, kb: number, requests: number): number {
  const rounds = 3 + Math.ceil(requests / 6);
  return p.rttMs / 1000 * rounds + (kb * 8 / 1000) / (p.mbps * 0.75);
}
export const ngnPerVisit = (kb: number) => kb / 1048576 * DATA.meta.dataCostNgnPerGB.value;

export function networkReport(inp: Inputs) {
  const rows = DATA.networks.map(p => {
    const t = loadSeconds(p, inp.pageWeightKB, inp.requestsPerPage);
    return { profile: p, seconds: t, verdict: t <= 3 ? 'good' : t <= 8 ? 'slow' : 'painful', share: inp.mix[p.id] ?? 0 };
  });
  const total = rows.reduce((a, r) => a + r.share, 0) || 1;
  const painfulShare = rows.filter(r => r.seconds > 10).reduce((a, r) => a + r.share, 0) / total;
  const avg = rows.reduce((a, r) => a + r.seconds * r.share, 0) / total;
  return { rows, painfulShare, avg, ngn: ngnPerVisit(inp.pageWeightKB), budgetKB: budgetFor(inp.requestsPerPage) };
}

/** Largest page weight that loads in about 5 s on 3G. */
function budgetFor(requests: number) {
  const p = DATA.networks.find(n => n.id === '3g')!;
  const fixed = p.rttMs / 1000 * (3 + Math.ceil(requests / 6));
  return Math.max(100, Math.round((5 - fixed) * p.mbps * 0.75 * 1000 / 8));
}

export const DEFAULT_MIX: Record<string, number> = { mtn4g: 32, airtel4g: 18, glo4g: 10, '3g': 4, '2g': 36, badday: 0 };
