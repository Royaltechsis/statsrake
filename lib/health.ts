import type { Dep } from './types';

export interface Health { name: string; installed?: string; latest?: string; behind: 'current' | 'patch' | 'minor' | 'major' | 'unknown'; deprecated?: string; vulns: { id: string; summary: string; severity?: string }[]; error?: string }

async function j(url: string, init?: RequestInit, ms = 12000): Promise<any> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { ...init, signal: ctl.signal }); if (!r.ok) return null; return await r.json(); } catch { return null; } finally { clearTimeout(t); }
}
const enc = (n: string) => n.startsWith('@') ? '@' + encodeURIComponent(n.slice(1)) : encodeURIComponent(n);

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

function cmp(a?: string, b?: string): Health['behind'] {
  if (!a || !b) return 'unknown';
  const pa = a.split(/[.+-]/).map(Number), pb = b.split(/[.+-]/).map(Number);
  if (pa.slice(0, 3).some(isNaN) || pb.slice(0, 3).some(isNaN)) return 'unknown';
  if (pa[0] < pb[0]) return 'major'; if (pa[0] > pb[0]) return 'current';
  if (pa[1] < pb[1]) return 'minor'; if (pa[1] > pb[1]) return 'current';
  if (pa[2] < pb[2]) return 'patch'; return 'current';
}

/** Resolve installed versions (when no lockfile), then latest, deprecation and OSV vulnerabilities. */
export async function checkHealth(deps: Dep[], onProgress?: (done: number, total: number) => void): Promise<Health[]> {
  let done = 0; const total = deps.length;
  const isRegistry = (r: string) => !/^(file:|link:|workspace:|git|github:|https?:|\.|\/)/.test(r);
  const res = await pool(deps, 8, async (d): Promise<Health> => {
    const h: Health = { name: d.name, installed: d.installed, behind: 'unknown', vulns: [] };
    if (!isRegistry(d.range)) { h.error = 'not from the npm registry'; onProgress?.(++done, total); return h; }
    const [latest, resolved] = await Promise.all([
      j(`https://registry.npmjs.org/${enc(d.name)}/latest`),
      d.installed ? Promise.resolve(null) : (/^\d+\.\d+\.\d+$/.test(d.range.replace(/^=/, '')) ? Promise.resolve({ version: d.range.replace(/^=/, '') }) : j(`https://data.jsdelivr.com/v1/packages/npm/${d.name}/resolved?specifier=${encodeURIComponent(d.range === 'latest' || d.range === '*' ? 'latest' : d.range)}`)),
    ]);
    if (!d.installed && resolved?.version) { d.installed = resolved.version; d.via = /^\d+\.\d+\.\d+$/.test(d.range.replace(/^=/, '')) ? 'exact' : 'resolved'; h.installed = d.installed; }
    if (latest?.version) h.latest = latest.version; else h.error = 'not found on npm';
    h.behind = cmp(h.installed, h.latest);
    if (h.installed) {
      const vdoc = h.installed === h.latest ? latest : await j(`https://registry.npmjs.org/${enc(d.name)}/${encodeURIComponent(h.installed)}`);
      if (vdoc?.deprecated) h.deprecated = String(vdoc.deprecated);
    } else if (latest?.deprecated) h.deprecated = String(latest.deprecated);
    onProgress?.(++done, total);
    return h;
  });
  // OSV batch: one request for everything with a version.
  const q = res.filter(h => h.installed);
  if (q.length) {
    const r = await j('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries: q.map(h => ({ package: { name: h.name, ecosystem: 'npm' }, version: h.installed })) }) }, 20000);
    if (r?.results) {
      const ids = new Set<string>();
      r.results.forEach((x: any, i: number) => { for (const v of x.vulns || []) { q[i].vulns.push({ id: v.id, summary: '' }); ids.add(v.id); } });
      const details: Record<string, any> = {};
      await pool([...ids].slice(0, 40), 6, async id => { details[id] = await j(`https://api.osv.dev/v1/vulns/${id}`); });
      for (const h of q) for (const v of h.vulns) {
        const d = details[v.id];
        if (d) { v.summary = d.summary || (d.details || '').slice(0, 140); v.severity = d.database_specific?.severity || (d.severity?.[0]?.score ? 'scored' : undefined); }
        const alias = d?.aliases?.find((a: string) => a.startsWith('CVE-')); if (alias) v.id = `${v.id} / ${alias}`;
      }
    } else for (const h of q) h.error = (h.error ? h.error + '; ' : '') + 'vulnerability check unavailable';
  }
  return res;
}
